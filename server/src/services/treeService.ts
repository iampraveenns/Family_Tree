import { memberRepository } from '../repositories/memberRepository.ts';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { familyService } from './familyService.ts';
import { ServiceContext } from './familyService.ts';

export interface NormalizedTreeData {
  family: {
    id: string;
    name: string;
    description?: string;
    originPlace?: string;
    motto?: string;
  };
  members: Array<{
    id: string;
    familyId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;
    gender: string;
    dateOfBirth?: string;
    dateOfDeath?: string;
    isLiving: boolean;
    birthPlace?: string;
    deathPlace?: string;
    houseName?: string;
    location?: string;
    occupation?: string;
    education?: string;
    biography?: string;
    profilePhoto?: string;
    generation: number;
    branchIds: string[];
  }>;
  relationships: Array<{
    id: string;
    familyId: string;
    sourceMemberId: string;
    targetMemberId: string;
    relationshipType: string;
    status: string;
    marriageDate?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  branches: Array<{
    id: string;
    familyId: string;
    name: string;
    description?: string;
    rootMemberId: string;
    accentColor?: string;
    coverImage?: string;
  }>;
}

export class TreeService {
  async getFamilyTree(familyId: string, context?: ServiceContext): Promise<NormalizedTreeData> {
    const family = await familyService.getFamilyById(familyId, context);
    const resolvedFamilyId = family._id.toString();

    const [members, relationships, branches] = await Promise.all([
      memberRepository.findAllByFamily(resolvedFamilyId),
      relationshipRepository.findByFamilyId(resolvedFamilyId),
      branchRepository.findByFamilyId(resolvedFamilyId),
    ]);

    return {
      family: {
        id: family._id.toString(),
        name: family.name,
        description: family.description,
        originPlace: family.originPlace,
        motto: family.motto,
      },
      members: members.map((m) => ({
        id: m._id.toString(),
        familyId: m.familyId.toString(),
        firstName: m.firstName,
        middleName: m.middleName,
        lastName: m.lastName,
        displayName: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        gender: m.gender,
        dateOfBirth: m.dateOfBirth,
        dateOfDeath: m.dateOfDeath,
        isLiving: m.isLiving,
        birthPlace: m.birthPlace,
        deathPlace: m.deathPlace,
        houseName: (m as any).houseName,
        location: (m as any).location || m.birthPlace,
        occupation: m.occupation,
        education: m.education,
        biography: m.biography,
        profilePhoto: m.profilePhoto,
        generation: m.generation || 1,
        branchIds: (m.branchIds || []).map((b) => b.toString()),
      })),
      relationships: relationships.map((r) => ({
        id: r._id.toString(),
        familyId: r.familyId.toString(),
        sourceMemberId: r.sourceMemberId.toString(),
        targetMemberId: r.targetMemberId.toString(),
        relationshipType: r.relationshipType,
        status: r.status,
        marriageDate: r.marriageDate || (r.metadata as any)?.marriageDate || null,
        metadata: r.metadata,
      })),
      branches: branches.map((b) => ({
        id: b._id.toString(),
        familyId: b.familyId.toString(),
        name: b.name,
        description: b.description,
        rootMemberId: b.rootMemberId.toString(),
        accentColor: b.accentColor,
        coverImage: b.coverImage,
      })),
    };
  }
}

export const treeService = new TreeService();
