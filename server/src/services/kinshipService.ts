import { memberRepository } from '../repositories/memberRepository.ts';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { familyService } from './familyService.ts';
import { NotFoundError, ValidationError } from '../utils/errors.ts';
import { ErrorCode, RelationshipType } from '../constants/index.ts';
import { ServiceContext } from './familyService.ts';

interface GraphEdge {
  neighborId: string;
  relationshipType: string;
  stepDescription: string;
}

export interface KinshipPathStep {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  step: string;
}

export interface ConnectingMemberInfo {
  id: string;
  name: string;
  gender: string;
  generation: number;
  profilePhoto?: string;
  occupation?: string;
  branchName?: string;
}

export interface LineagePathStep {
  memberId: string;
  name: string;
  gender: string;
  generation: number;
  profilePhoto?: string;
  relationToNext: string;
}

export interface CommonAncestorInfo {
  ancestor: {
    id: string;
    name: string;
    gender: string;
    generation: number;
    profilePhoto?: string;
    dateOfBirth?: string;
    dateOfDeath?: string;
    isLiving: boolean;
  };
  isNearest: boolean;
  distanceToA: number;
  distanceToB: number;
  totalGenerationalDistance: number;
  lineageTypeA: 'PATERNAL' | 'MATERNAL' | 'DIRECT';
  lineageTypeB: 'PATERNAL' | 'MATERNAL' | 'DIRECT';
  pathFromAncestorToA: LineagePathStep[];
  pathFromAncestorToB: LineagePathStep[];
}

export interface CommonAncestorsResponse {
  personA: { id: string; name: string; generation: number; profilePhoto?: string; branchNames: string[] };
  personB: { id: string; name: string; generation: number; profilePhoto?: string; branchNames: string[] };
  nearestCommonAncestor: CommonAncestorInfo | null;
  allCommonAncestors: CommonAncestorInfo[];
  relationshipSummary: string;
}

export interface KinshipResult {
  source: {
    id: string;
    name: string;
    gender?: string;
    generation?: number;
    profilePhoto?: string;
    branchNames?: string[];
  };
  target: {
    id: string;
    name: string;
    gender?: string;
    generation?: number;
    profilePhoto?: string;
    branchNames?: string[];
  };
  relationship: string;
  degreeDescription: string;
  distance: number;
  path: KinshipPathStep[];
  connectingMembers: ConnectingMemberInfo[];
  commonAncestors?: CommonAncestorInfo[];
  sharedBranches: string[];
}

export class KinshipService {
  async calculateKinship(
    familyId: string,
    sourceMemberId: string,
    targetMemberId: string,
    context?: ServiceContext
  ): Promise<KinshipResult> {
    await familyService.getFamilyById(familyId, context);

    const [sourceMember, targetMember] = await Promise.all([
      memberRepository.findByFamilyAndId(familyId, sourceMemberId),
      memberRepository.findByFamilyAndId(familyId, targetMemberId),
    ]);

    if (!sourceMember) {
      throw new NotFoundError(`Source member '${sourceMemberId}' not found`, ErrorCode.MEMBER_NOT_FOUND);
    }

    if (!targetMember) {
      throw new NotFoundError(`Target member '${targetMemberId}' not found`, ErrorCode.MEMBER_NOT_FOUND);
    }

    const sourceName = sourceMember.displayName || `${sourceMember.firstName} ${sourceMember.lastName}`.trim();
    const targetName = targetMember.displayName || `${targetMember.firstName} ${targetMember.lastName}`.trim();

    // Fetch branches for labels
    const branches = await branchRepository.findByFamilyId(familyId);
    const branchMap = new Map<string, string>();
    branches.forEach((b: any) => branchMap.set(b._id.toString(), b.name));

    const sourceBranchNames = (sourceMember.branchIds || []).map((id) => branchMap.get(id.toString()) || 'Main Branch');
    const targetBranchNames = (targetMember.branchIds || []).map((id) => branchMap.get(id.toString()) || 'Main Branch');
    const sharedBranches = sourceBranchNames.filter((b) => targetBranchNames.includes(b));

    // 1. Self check
    if (sourceMemberId === targetMemberId) {
      return {
        source: {
          id: sourceMemberId,
          name: sourceName,
          gender: sourceMember.gender,
          generation: sourceMember.generation,
          profilePhoto: sourceMember.profilePhoto,
          branchNames: sourceBranchNames,
        },
        target: {
          id: targetMemberId,
          name: targetName,
          gender: targetMember.gender,
          generation: targetMember.generation,
          profilePhoto: targetMember.profilePhoto,
          branchNames: targetBranchNames,
        },
        relationship: 'SELF',
        degreeDescription: 'Identity (Same Person)',
        distance: 0,
        path: [],
        connectingMembers: [],
        sharedBranches,
      };
    }

    // 2. Fetch all members & relationships to construct graph
    const [allMembers, allRelationships] = await Promise.all([
      memberRepository.findAllByFamily(familyId),
      relationshipRepository.findByFamilyId(familyId),
    ]);

    const memberDocMap = new Map<string, any>();
    const memberNameMap = new Map<string, string>();
    for (const m of allMembers) {
      const mid = m._id.toString();
      memberDocMap.set(mid, m);
      memberNameMap.set(mid, m.displayName || `${m.firstName} ${m.lastName}`.trim());
    }

    const graph = new Map<string, GraphEdge[]>();
    const addEdge = (u: string, v: string, relType: string, stepDesc: string) => {
      if (!graph.has(u)) graph.set(u, []);
      graph.get(u)!.push({ neighborId: v, relationshipType: relType, stepDescription: stepDesc });
    };

    for (const rel of allRelationships) {
      const src = rel.sourceMemberId.toString();
      const tgt = rel.targetMemberId.toString();

      if (rel.relationshipType === RelationshipType.PARENT) {
        // src is parent, tgt is child
        addEdge(src, tgt, 'CHILD', 'child');
        addEdge(tgt, src, 'PARENT', 'parent');
      } else if (rel.relationshipType === RelationshipType.SPOUSE) {
        addEdge(src, tgt, 'SPOUSE', 'spouse');
        addEdge(tgt, src, 'SPOUSE', 'spouse');
      } else if (rel.relationshipType === RelationshipType.SIBLING) {
        addEdge(src, tgt, 'SIBLING', 'sibling');
        addEdge(tgt, src, 'SIBLING', 'sibling');
      } else {
        addEdge(src, tgt, rel.relationshipType, rel.relationshipType.toLowerCase());
        addEdge(tgt, src, rel.relationshipType, rel.relationshipType.toLowerCase());
      }
    }

    // 3. BFS to find shortest relationship path
    interface QueueItem {
      memberId: string;
      path: Array<{ fromId: string; toId: string; step: string }>;
    }

    const queue: QueueItem[] = [{ memberId: sourceMemberId, path: [] }];
    const visited = new Set<string>([sourceMemberId]);
    let foundPath: Array<{ fromId: string; toId: string; step: string }> | null = null;

    while (queue.length > 0) {
      const { memberId, path } = queue.shift()!;

      if (memberId === targetMemberId) {
        foundPath = path;
        break;
      }

      const edges = graph.get(memberId) || [];
      for (const edge of edges) {
        if (!visited.has(edge.neighborId)) {
          visited.add(edge.neighborId);
          queue.push({
            memberId: edge.neighborId,
            path: [...path, { fromId: memberId, toId: edge.neighborId, step: edge.relationshipType }],
          });
        }
      }
    }

    if (!foundPath) {
      return {
        source: {
          id: sourceMemberId,
          name: sourceName,
          gender: sourceMember.gender,
          generation: sourceMember.generation,
          profilePhoto: sourceMember.profilePhoto,
          branchNames: sourceBranchNames,
        },
        target: {
          id: targetMemberId,
          name: targetName,
          gender: targetMember.gender,
          generation: targetMember.generation,
          profilePhoto: targetMember.profilePhoto,
          branchNames: targetBranchNames,
        },
        relationship: 'NO_DIRECT_PATH_FOUND',
        degreeDescription: 'No recorded lineage link',
        distance: -1,
        path: [],
        connectingMembers: [],
        sharedBranches,
      };
    }

    const steps = foundPath.map((item) => item.step);
    const relationshipTerm = this.determineKinshipTerm(steps, targetMember.gender);
    const degreeDescription = this.determineDegreeDescription(steps, relationshipTerm);

    const detailedPath: KinshipPathStep[] = foundPath.map((item) => ({
      fromId: item.fromId,
      fromName: memberNameMap.get(item.fromId) || item.fromId,
      toId: item.toId,
      toName: memberNameMap.get(item.toId) || item.toId,
      step: item.step,
    }));

    // Collect connecting members along the path (including source and target)
    const uniqueIdsInPath: string[] = [];
    foundPath.forEach((p) => {
      if (!uniqueIdsInPath.includes(p.fromId)) uniqueIdsInPath.push(p.fromId);
      if (!uniqueIdsInPath.includes(p.toId)) uniqueIdsInPath.push(p.toId);
    });

    const connectingMembers: ConnectingMemberInfo[] = uniqueIdsInPath.map((mid) => {
      const doc = memberDocMap.get(mid);
      const bNames = (doc?.branchIds || []).map((bId: any) => branchMap.get(bId.toString()) || 'Branch');
      return {
        id: mid,
        name: memberNameMap.get(mid) || mid,
        gender: doc?.gender || 'UNKNOWN',
        generation: doc?.generation || 1,
        profilePhoto: doc?.profilePhoto,
        occupation: doc?.occupation,
        branchName: bNames[0] || 'Main Branch',
      };
    });

    // Check common ancestors
    const commonAncestorsResponse = await this.findCommonAncestors(familyId, sourceMemberId, targetMemberId);

    return {
      source: {
        id: sourceMemberId,
        name: sourceName,
        gender: sourceMember.gender,
        generation: sourceMember.generation,
        profilePhoto: sourceMember.profilePhoto,
        branchNames: sourceBranchNames,
      },
      target: {
        id: targetMemberId,
        name: targetName,
        gender: targetMember.gender,
        generation: targetMember.generation,
        profilePhoto: targetMember.profilePhoto,
        branchNames: targetBranchNames,
      },
      relationship: relationshipTerm,
      degreeDescription,
      distance: detailedPath.length,
      path: detailedPath,
      connectingMembers,
      commonAncestors: commonAncestorsResponse.allCommonAncestors,
      sharedBranches,
    };
  }

  /**
   * Discovers nearest and all common ancestors between two family members
   */
  async findCommonAncestors(
    familyId: string,
    memberAId: string,
    memberBId: string,
    context?: ServiceContext
  ): Promise<CommonAncestorsResponse> {
    await familyService.getFamilyById(familyId, context);

    const [memberA, memberB, allMembers, allRelationships, branches] = await Promise.all([
      memberRepository.findByFamilyAndId(familyId, memberAId),
      memberRepository.findByFamilyAndId(familyId, memberBId),
      memberRepository.findAllByFamily(familyId),
      relationshipRepository.findByFamilyId(familyId),
      branchRepository.findByFamilyId(familyId),
    ]);

    if (!memberA) throw new NotFoundError(`Member '${memberAId}' not found`, ErrorCode.MEMBER_NOT_FOUND);
    if (!memberB) throw new NotFoundError(`Member '${memberBId}' not found`, ErrorCode.MEMBER_NOT_FOUND);

    const branchMap = new Map<string, string>();
    branches.forEach((b: any) => branchMap.set(b._id.toString(), b.name));

    const memberMap = new Map<string, any>();
    allMembers.forEach((m) => memberMap.set(m._id.toString(), m));

    // Build parent adjacency map: childId -> Array of { parentId, parentDoc }
    const parentMap = new Map<string, string[]>();
    for (const rel of allRelationships) {
      const src = rel.sourceMemberId.toString();
      const tgt = rel.targetMemberId.toString();
      if (rel.relationshipType === RelationshipType.PARENT) {
        // src is parent, tgt is child
        if (!parentMap.has(tgt)) parentMap.set(tgt, []);
        parentMap.get(tgt)!.push(src);
      }
    }

    // Traverse upwards to collect all ancestors with path:
    // returns Map<ancestorId, { distance: number, pathFromAncestorToPerson: string[] }>
    const getAncestors = (personId: string) => {
      const ancestors = new Map<string, { distance: number; path: string[] }>();
      // BFS queue storing { currentMemberId, pathFromCurrentToPerson }
      const queue: Array<{ id: string; path: string[] }> = [{ id: personId, path: [personId] }];
      const visited = new Set<string>([personId]);

      while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        const parents = parentMap.get(id) || [];
        for (const pId of parents) {
          if (!visited.has(pId)) {
            visited.add(pId);
            const pathUp = [pId, ...path];
            ancestors.set(pId, {
              distance: pathUp.length - 1,
              path: pathUp,
            });
            queue.push({ id: pId, path: pathUp });
          }
        }
      }
      return ancestors;
    };

    const ancestorsA = getAncestors(memberAId);
    const ancestorsB = getAncestors(memberBId);

    // Common ancestor candidates
    const commonAncestorInfos: CommonAncestorInfo[] = [];

    // Find intersection
    for (const [ancId, aInfo] of ancestorsA.entries()) {
      if (ancestorsB.has(ancId)) {
        const bInfo = ancestorsB.get(ancId)!;
        const ancestorDoc = memberMap.get(ancId);
        if (!ancestorDoc) continue;

        // Determine maternal vs paternal path to A:
        // In path [ancId, ..., immediateParentOfA, memberAId]
        let lineageTypeA: 'PATERNAL' | 'MATERNAL' | 'DIRECT' = 'DIRECT';
        if (aInfo.path.length >= 2) {
          const parentOfA = memberMap.get(aInfo.path[aInfo.path.length - 2]);
          if (parentOfA) {
            lineageTypeA = parentOfA.gender === 'FEMALE' ? 'MATERNAL' : 'PATERNAL';
          }
        }

        let lineageTypeB: 'PATERNAL' | 'MATERNAL' | 'DIRECT' = 'DIRECT';
        if (bInfo.path.length >= 2) {
          const parentOfB = memberMap.get(bInfo.path[bInfo.path.length - 2]);
          if (parentOfB) {
            lineageTypeB = parentOfB.gender === 'FEMALE' ? 'MATERNAL' : 'PATERNAL';
          }
        }

        const formatPath = (pathIds: string[]): LineagePathStep[] => {
          return pathIds.map((id, index) => {
            const doc = memberMap.get(id);
            const isLast = index === pathIds.length - 1;
            const nextDoc = !isLast ? memberMap.get(pathIds[index + 1]) : null;
            return {
              memberId: id,
              name: doc?.displayName || `${doc?.firstName} ${doc?.lastName}`.trim(),
              gender: doc?.gender || 'UNKNOWN',
              generation: doc?.generation || 1,
              profilePhoto: doc?.profilePhoto,
              relationToNext: nextDoc ? 'Parent of' : 'Target',
            };
          });
        };

        commonAncestorInfos.push({
          ancestor: {
            id: ancId,
            name: ancestorDoc.displayName || `${ancestorDoc.firstName} ${ancestorDoc.lastName}`.trim(),
            gender: ancestorDoc.gender,
            generation: ancestorDoc.generation,
            profilePhoto: ancestorDoc.profilePhoto,
            dateOfBirth: ancestorDoc.dateOfBirth,
            dateOfDeath: ancestorDoc.dateOfDeath,
            isLiving: ancestorDoc.isLiving,
          },
          isNearest: false,
          distanceToA: aInfo.distance,
          distanceToB: bInfo.distance,
          totalGenerationalDistance: aInfo.distance + bInfo.distance,
          lineageTypeA,
          lineageTypeB,
          pathFromAncestorToA: formatPath(aInfo.path),
          pathFromAncestorToB: formatPath(bInfo.path),
        });
      }
    }

    // Sort common ancestors by total generational distance ascending (closest first)
    commonAncestorInfos.sort((x, y) => x.totalGenerationalDistance - y.totalGenerationalDistance);

    if (commonAncestorInfos.length > 0) {
      commonAncestorInfos[0].isNearest = true;
    }

    const nearest = commonAncestorInfos.length > 0 ? commonAncestorInfos[0] : null;

    let summary = 'No common ancestor discovered in recorded lineage.';
    if (nearest) {
      summary = `${nearest.ancestor.name} is the Nearest Common Ancestor (${nearest.distanceToA} generations from ${memberA.firstName}, ${nearest.distanceToB} generations from ${memberB.firstName}).`;
    }

    const nameA = memberA.displayName || `${memberA.firstName} ${memberA.lastName}`.trim();
    const nameB = memberB.displayName || `${memberB.firstName} ${memberB.lastName}`.trim();
    const branchNamesA = (memberA.branchIds || []).map((id) => branchMap.get(id.toString()) || 'Main Branch');
    const branchNamesB = (memberB.branchIds || []).map((id) => branchMap.get(id.toString()) || 'Main Branch');

    return {
      personA: {
        id: memberAId,
        name: nameA,
        generation: memberA.generation,
        profilePhoto: memberA.profilePhoto,
        branchNames: branchNamesA,
      },
      personB: {
        id: memberBId,
        name: nameB,
        generation: memberB.generation,
        profilePhoto: memberB.profilePhoto,
        branchNames: branchNamesB,
      },
      nearestCommonAncestor: nearest,
      allCommonAncestors: commonAncestorInfos,
      relationshipSummary: summary,
    };
  }

  private determineDegreeDescription(steps: string[], term: string): string {
    if (steps.length === 0) return 'Identity';
    if (steps.length === 1) {
      if (steps[0] === 'PARENT' || steps[0] === 'CHILD') return '1st Degree Direct Lineage';
      if (steps[0] === 'SPOUSE') return 'Conjugal Bond (Direct Spouse)';
      if (steps[0] === 'SIBLING') return '1st Degree Collateral Lineage';
    }
    if (steps.length === 2) {
      if (steps.every((s) => s === 'PARENT' || s === 'CHILD')) return '2nd Degree Direct Ancestry';
      if (steps.includes('SIBLING')) return '2nd Degree Collateral Lineage';
    }
    if (steps.length === 3) {
      if (steps.includes('SIBLING')) return '3rd Degree Collateral (First Cousin)';
      if (steps.every((s) => s === 'PARENT' || s === 'CHILD')) return '3rd Degree Direct Lineage';
    }
    return `${steps.length}th Degree Lineage Connection`;
  }

  private determineKinshipTerm(steps: string[], targetGender?: string): string {
    const isMale = targetGender === 'MALE';
    const isFemale = targetGender === 'FEMALE';

    if (steps.length === 1) {
      const step = steps[0];
      if (step === 'PARENT') return isMale ? 'FATHER' : isFemale ? 'MOTHER' : 'PARENT';
      if (step === 'CHILD') return isMale ? 'SON' : isFemale ? 'DAUGHTER' : 'CHILD';
      if (step === 'SPOUSE') return isMale ? 'HUSBAND' : isFemale ? 'WIFE' : 'SPOUSE';
      if (step === 'SIBLING') return isMale ? 'BROTHER' : isFemale ? 'SISTER' : 'SIBLING';
      return step;
    }

    if (steps.length === 2) {
      const [s1, s2] = steps;
      if (s1 === 'PARENT' && s2 === 'PARENT') {
        return isMale ? 'GRANDFATHER' : isFemale ? 'GRANDMOTHER' : 'GRANDPARENT';
      }
      if (s1 === 'CHILD' && s2 === 'CHILD') {
        return isMale ? 'GRANDSON' : isFemale ? 'GRANDDAUGHTER' : 'GRANDCHILD';
      }
      if (s1 === 'PARENT' && s2 === 'SIBLING') {
        return isMale ? 'UNCLE' : isFemale ? 'AUNT' : 'AUNT_OR_UNCLE';
      }
      if (s1 === 'SIBLING' && s2 === 'CHILD') {
        return isMale ? 'NEPHEW' : isFemale ? 'NIECE' : 'NIECE_OR_NEPHEW';
      }
      if (s1 === 'SPOUSE' && s2 === 'PARENT') {
        return isMale ? 'FATHER_IN_LAW' : isFemale ? 'MOTHER_IN_LAW' : 'PARENT_IN_LAW';
      }
      if (s1 === 'CHILD' && s2 === 'SPOUSE') {
        return isMale ? 'SON_IN_LAW' : isFemale ? 'DAUGHTER_IN_LAW' : 'CHILD_IN_LAW';
      }
      if (s1 === 'SIBLING' && s2 === 'SPOUSE') {
        return isMale ? 'BROTHER_IN_LAW' : isFemale ? 'SISTER_IN_LAW' : 'SIBLING_IN_LAW';
      }
      if (s1 === 'SPOUSE' && s2 === 'SIBLING') {
        return isMale ? 'BROTHER_IN_LAW' : isFemale ? 'SISTER_IN_LAW' : 'SIBLING_IN_LAW';
      }
    }

    if (steps.length === 3) {
      const [s1, s2, s3] = steps;
      if (s1 === 'PARENT' && s2 === 'SIBLING' && s3 === 'CHILD') {
        return 'FIRST_COUSIN';
      }
      if (s1 === 'PARENT' && s2 === 'PARENT' && s3 === 'PARENT') {
        return isMale ? 'GREAT_GRANDFATHER' : isFemale ? 'GREAT_GRANDMOTHER' : 'GREAT_GRANDPARENT';
      }
      if (s1 === 'CHILD' && s2 === 'CHILD' && s3 === 'CHILD') {
        return isMale ? 'GREAT_GRANDSON' : isFemale ? 'GREAT_GRANDDAUGHTER' : 'GREAT_GRANDCHILD';
      }
    }

    if (steps.every((s) => s === 'PARENT')) {
      return 'ANCESTOR';
    }
    if (steps.every((s) => s === 'CHILD')) {
      return 'DESCENDANT';
    }

    return 'RELATIVE';
  }
}

export const kinshipService = new KinshipService();
