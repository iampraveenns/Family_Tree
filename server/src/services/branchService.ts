import { Types } from 'mongoose';
import { branchRepository } from '../repositories/branchRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { familyService } from './familyService.ts';
import { auditService } from './auditService.ts';
import { IBranch } from '../models/Branch.ts';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.ts';
import { AuditAction, ErrorCode, BranchVisibility } from '../constants/index.ts';
import { ServiceContext } from './familyService.ts';

export interface CreateBranchInput {
  name: string;
  description?: string;
  rootMemberId: string;
  coverImage?: string;
  accentColor?: string;
  visibility?: BranchVisibility;
}

/**
 * Strictly format branch names as '<First Name> <Last Name> Branch' (e.g. 'Sathiyam Soni Branch').
 * Strips apostrophes ('s, ’s), trailing Family/Branch, and extra spaces.
 */
export function formatStandardBranchName(name?: string | null): string {
  if (!name) return '';
  let cleaned = name.trim();
  // Strip trailing "Branch"
  cleaned = cleaned.replace(/\s+Branch$/i, '').trim();
  // Strip possessive apostrophes
  cleaned = cleaned.replace(/['’]s\b/gi, '').trim();
  // Strip stray "s" / "S" leftover from basic apostrophe deletion
  cleaned = cleaned.replace(/\s+[sS]\b/g, '').trim();
  // Strip the word "Family"
  cleaned = cleaned.replace(/\bFamily\b/gi, '').trim();
  // Collapse duplicate whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Branch';
  return `${cleaned} Branch`;
}

export class BranchService {
  async createBranch(familyId: string, input: CreateBranchInput, context?: ServiceContext): Promise<IBranch> {
    await familyService.getFamilyById(familyId, context);

    const { name, description, rootMemberId, coverImage, accentColor, visibility } = input;

    // Validate root member exists and belongs to family
    if (!Types.ObjectId.isValid(rootMemberId)) {
      throw new ValidationError('Invalid root member ID');
    }

    const rootMember = await memberRepository.findByFamilyAndId(familyId, rootMemberId);
    if (!rootMember) {
      throw new NotFoundError(
        `Root member '${rootMemberId}' not found in family '${familyId}'`,
        ErrorCode.MEMBER_NOT_FOUND
      );
    }

    // Validate unique name within family
    const existing = await branchRepository.findByName(familyId, name);
    if (existing) {
      throw new ConflictError(
        `A branch named '${name}' already exists in this family`,
        ErrorCode.DUPLICATE_ENTITY
      );
    }

    const branch = await branchRepository.create({
      familyId: new Types.ObjectId(familyId),
      name: name.trim(),
      description: description?.trim() || '',
      rootMemberId: new Types.ObjectId(rootMemberId),
      coverImage: coverImage || '',
      accentColor: accentColor || '#d4a373',
      visibility: visibility || BranchVisibility.FAMILY,
      createdBy: context?.userId || 'system',
    });

    // Optionally ensure the root member has this branch in their branchIds
    if (!rootMember.branchIds.some((b) => b.toString() === branch._id.toString())) {
      rootMember.branchIds.push(branch._id);
      await rootMember.save();
    }

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.BRANCH_CREATED,
      'Branch',
      branch._id.toString(),
      { name: branch.name, rootMemberId }
    );

    return branch;
  }

  async getBranches(familyId: string, context?: ServiceContext): Promise<IBranch[]> {
    await familyService.getFamilyById(familyId, context);
    return branchRepository.findByFamilyId(familyId);
  }

  async getBranchById(familyId: string, branchId: string, context?: ServiceContext): Promise<IBranch> {
    await familyService.getFamilyById(familyId, context);

    if (!Types.ObjectId.isValid(branchId)) {
      throw new NotFoundError(`Branch '${branchId}' not found`, ErrorCode.BRANCH_NOT_FOUND);
    }

    const branch = await branchRepository.findByFamilyAndId(familyId, branchId);
    if (!branch) {
      throw new NotFoundError(
        `Branch '${branchId}' not found in family '${familyId}'`,
        ErrorCode.BRANCH_NOT_FOUND
      );
    }

    return branch;
  }

  async updateBranch(
    familyId: string,
    branchId: string,
    data: Partial<CreateBranchInput>,
    context?: ServiceContext
  ): Promise<IBranch> {
    const existing = await this.getBranchById(familyId, branchId, context);

    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameConflict = await branchRepository.findByName(familyId, data.name);
      if (nameConflict && nameConflict._id.toString() !== branchId) {
        throw new ConflictError(
          `A branch named '${data.name}' already exists in this family`,
          ErrorCode.DUPLICATE_ENTITY
        );
      }
    }

    if (data.rootMemberId && data.rootMemberId !== existing.rootMemberId.toString()) {
      const rootMember = await memberRepository.findByFamilyAndId(familyId, data.rootMemberId);
      if (!rootMember) {
        throw new NotFoundError(
          `New root member '${data.rootMemberId}' not found in family '${familyId}'`,
          ErrorCode.MEMBER_NOT_FOUND
        );
      }
    }

    const updatePayload: Partial<IBranch> = { ...data } as unknown as Partial<IBranch>;
    if (data.rootMemberId) {
      updatePayload.rootMemberId = new Types.ObjectId(data.rootMemberId);
    }

    const updated = await branchRepository.update(branchId, updatePayload);
    if (!updated) {
      throw new NotFoundError('Branch not found for update', ErrorCode.BRANCH_NOT_FOUND);
    }

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.BRANCH_UPDATED,
      'Branch',
      branchId,
      data as Record<string, unknown>
    );

    return updated;
  }

  async deleteBranch(familyId: string, branchId: string, context?: ServiceContext): Promise<boolean> {
    await this.getBranchById(familyId, branchId, context);

    // Section 19: Do NOT delete members when a branch is deleted.
    // Member lifecycle and branch lifecycle are decoupled.
    const deleted = await branchRepository.delete(branchId);

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.BRANCH_DELETED,
      'Branch',
      branchId
    );

    return deleted;
  }

  /**
   * Interactive Family Branch Explorer
   * Gathers root member, descendant hierarchy, member stats, memories, and timeline milestones
   */
  async getBranchExplorer(familyId: string, branchId: string, context?: ServiceContext): Promise<any> {
    const branch = await this.getBranchById(familyId, branchId, context);
    const bOid = new Types.ObjectId(branchId);
    const fOid = new Types.ObjectId(familyId);

    const { FamilyMember } = await import('../models/FamilyMember.ts');
    const { Memory } = await import('../models/Memory.ts');
    const { FamilyEvent } = await import('../models/FamilyEvent.ts');
    const { Relationship } = await import('../models/Relationship.ts');

    const [members, rootMember, memories, events, relationships] = await Promise.all([
      FamilyMember.find({ familyId: fOid, branchIds: bOid, isArchived: { $ne: true } })
        .sort({ generation: 1, dateOfBirth: 1 })
        .lean(),
      FamilyMember.findOne({ _id: branch.rootMemberId, familyId: fOid }).lean(),
      Memory.find({ familyId: fOid, branchIds: bOid })
        .populate('coverMediaId', 'thumbnailStorageKey storageKey mimeType')
        .sort({ eventDate: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      FamilyEvent.find({ familyId: fOid, branchIds: bOid, status: 'ACTIVE' })
        .sort({ eventDate: 1 })
        .limit(8)
        .lean(),
      Relationship.find({ familyId: fOid }).lean(),
    ]);

    // Build descendants tree from root member
    const memberMap = new Map<string, any>();
    members.forEach((m: any) => memberMap.set(m._id.toString(), m));
    if (rootMember) {
      memberMap.set(rootMember._id.toString(), rootMember);
    }

    const parentToChildren = new Map<string, string[]>();
    relationships.forEach((rel: any) => {
      if (rel.relationshipType === 'PARENT') {
        const pId = rel.sourceMemberId.toString();
        const cId = rel.targetMemberId.toString();
        if (!parentToChildren.has(pId)) parentToChildren.set(pId, []);
        parentToChildren.get(pId)!.push(cId);
      }
    });

    const buildHierarchy = (currentId: string, visited = new Set<string>()): any => {
      if (visited.has(currentId)) return null;
      visited.add(currentId);
      const doc = memberMap.get(currentId);
      if (!doc) return null;

      const childrenIds = parentToChildren.get(currentId) || [];
      const childrenNodes = childrenIds
        .map((cId) => buildHierarchy(cId, new Set(visited)))
        .filter(Boolean);

      return {
        id: currentId,
        name: doc.displayName || `${doc.firstName} ${doc.lastName}`.trim(),
        gender: doc.gender,
        generation: doc.generation,
        occupation: doc.occupation,
        profilePhoto: doc.profilePhoto,
        isLiving: doc.isLiving,
        birthPlace: doc.birthPlace,
        children: childrenNodes,
      };
    };

    const rootIdStr = branch.rootMemberId ? branch.rootMemberId.toString() : '';
    const descendantsHierarchy = rootIdStr ? buildHierarchy(rootIdStr) : null;

    // Generational breakdown
    const generationCounts: Record<number, number> = {};
    let livingCount = 0;
    members.forEach((m: any) => {
      const gen = m.generation || 1;
      generationCounts[gen] = (generationCounts[gen] || 0) + 1;
      if (m.isLiving) livingCount++;
    });

    const totalMemories = await Memory.countDocuments({ familyId: fOid, branchIds: bOid });
    const totalEvents = await FamilyEvent.countDocuments({ familyId: fOid, branchIds: bOid, status: 'ACTIVE' });

    return {
      branch: {
        id: branch._id.toString(),
        name: branch.name,
        description: branch.description,
        accentColor: branch.accentColor,
        coverImage: branch.coverImage,
        createdAt: branch.createdAt,
      },
      rootMember: rootMember
        ? {
            id: rootMember._id.toString(),
            name: rootMember.displayName || `${rootMember.firstName} ${rootMember.lastName}`.trim(),
            gender: rootMember.gender,
            generation: rootMember.generation,
            occupation: rootMember.occupation,
            profilePhoto: rootMember.profilePhoto,
            isLiving: rootMember.isLiving,
            biography: rootMember.biography,
          }
        : null,
      stats: {
        totalMembers: members.length,
        livingMembers: livingCount,
        deceasedMembers: members.length - livingCount,
        totalMemories,
        totalEvents,
        generationCounts,
      },
      descendantsHierarchy,
      members: members.map((m: any) => ({
        id: m._id.toString(),
        name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        gender: m.gender,
        generation: m.generation,
        occupation: m.occupation,
        birthPlace: m.birthPlace,
        profilePhoto: m.profilePhoto,
        isLiving: m.isLiving,
        dateOfBirth: m.dateOfBirth,
        dateOfDeath: m.dateOfDeath,
      })),
      recentMemories: memories.map((mem: any) => ({
        id: mem._id.toString(),
        title: mem.title,
        description: mem.description,
        memoryType: mem.memoryType,
        eventDate: mem.eventDate,
        eventDateApprox: mem.eventDateApprox,
        location: mem.location,
        coverMediaUrl: mem.coverMediaId ? `/api/media/${mem.coverMediaId._id || mem.coverMediaId}/stream` : undefined,
      })),
      recentEvents: events.map((e: any) => ({
        id: e._id.toString(),
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        eventDate: e.eventDate,
        location: e.location,
        era: e.era,
      })),
    };
  }

  /**
   * Archives or un-archives a branch.
   */
  async archiveBranch(
    familyId: string,
    branchId: string,
    isArchived: boolean,
    context?: ServiceContext
  ): Promise<IBranch> {
    const branch = await this.getBranchById(familyId, branchId, context);

    if (context?.userId) {
      const { authorizationService } = await import('./authorizationService.ts');
      const auth = await authorizationService.canManageBranch(
        context.userId,
        familyId,
        branchId,
        'ARCHIVE'
      );
      if (!auth.allowed) {
        throw new ForbiddenError(auth.reason || 'Unauthorized to archive this branch');
      }
    }

    branch.isArchived = isArchived;
    await branch.save();

    await auditService.log(
      familyId,
      context?.userId || 'system',
      isArchived ? AuditAction.BRANCH_ARCHIVED : AuditAction.BRANCH_UPDATED,
      'Branch',
      branchId,
      { isArchived }
    );

    return branch;
  }

  /**
   * Assigns user managers to a branch.
   */
  async assignManagers(
    familyId: string,
    branchId: string,
    managerIds: string[],
    context?: ServiceContext
  ): Promise<IBranch> {
    const branch = await this.getBranchById(familyId, branchId, context);

    if (context?.userId) {
      const { authorizationService } = await import('./authorizationService.ts');
      const auth = await authorizationService.canManageBranch(
        context.userId,
        familyId,
        branchId,
        'ASSIGN_MANAGER'
      );
      if (!auth.allowed) {
        throw new ForbiddenError(auth.reason || 'Unauthorized to assign branch managers');
      }
    }

    const oids = managerIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    branch.managerIds = oids;
    await branch.save();

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.BRANCH_MANAGER_ASSIGNED,
      'Branch',
      branchId,
      { managerIds }
    );

    return branch;
  }

  /**
   * Safely transfers a member to a destination branch.
   */
  async transferMember(
    familyId: string,
    data: { memberId: string; fromBranchId?: string; targetBranchId: string },
    context?: ServiceContext
  ) {
    const { memberId, fromBranchId, targetBranchId } = data;

    if (!Types.ObjectId.isValid(memberId) || !Types.ObjectId.isValid(targetBranchId)) {
      throw new ValidationError('Invalid memberId or targetBranchId');
    }

    const member = await memberRepository.findByFamilyAndId(familyId, memberId);
    if (!member) {
      throw new NotFoundError(`Member '${memberId}' not found in family`, ErrorCode.MEMBER_NOT_FOUND);
    }

    const targetBranch = await this.getBranchById(familyId, targetBranchId, context);
    if (!targetBranch) {
      throw new NotFoundError(`Target branch '${targetBranchId}' not found`, ErrorCode.BRANCH_NOT_FOUND);
    }

    if (context?.userId) {
      const { authorizationService } = await import('./authorizationService.ts');
      const auth = await authorizationService.canTransferMember(
        context.userId,
        familyId,
        memberId,
        fromBranchId,
        targetBranchId
      );
      if (!auth.allowed) {
        throw new ForbiddenError(auth.reason || 'Unauthorized to transfer member between branches');
      }
    }

    const targetOid = new Types.ObjectId(targetBranchId);

    // Filter out source branch (or remove from previous branch if specified)
    if (fromBranchId) {
      member.branchIds = member.branchIds.filter((b) => b.toString() !== fromBranchId);
    }

    // Add target branch if not already present
    if (!member.branchIds.some((b) => b.toString() === targetBranchId)) {
      member.branchIds.push(targetOid);
    }

    await member.save();

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.MEMBER_TRANSFERRED,
      'FamilyMember',
      memberId,
      { memberName: member.displayName || `${member.firstName} ${member.lastName}`, fromBranchId, targetBranchId, targetBranchName: targetBranch.name }
    );

    return {
      success: true,
      memberId,
      branchIds: member.branchIds.map((b) => b.toString()),
      targetBranchName: targetBranch.name,
    };
  }

  /**
   * Automatic Branch Creation:
   * Whenever a person in the tree has both a spouse and a child,
   * automatically create a separate, dedicated branch strictly formatted as
   * '<First Name> <Last Name> Branch' (e.g., 'Sathiyam Soni Branch').
   * Deduplicates branches so only one branch exists per name.
   */
  async syncAutomaticBranches(familyId: string, context?: ServiceContext): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(familyId)) return;
      const familyOid = new Types.ObjectId(familyId);
      const members = await memberRepository.findAllByFamily(familyId);
      if (!members || members.length === 0) return;

      const { relationshipRepository } = await import('../repositories/relationshipRepository.ts');
      const { Branch } = await import('../models/Branch.ts');

      // 1. Cleanup, normalize, and deduplicate all existing branches in the database for this family
      const existingBranches = await Branch.find({ familyId: familyOid });
      const canonicalBranchesByNormName = new Map<string, any>();
      const branchesToDelete: any[] = [];
      const branchIdRedirectMap = new Map<string, Types.ObjectId>();

      for (const b of existingBranches) {
        const stdName = formatStandardBranchName(b.name);
        const normKey = stdName.toLowerCase();
        if (!canonicalBranchesByNormName.has(normKey)) {
          if (b.name !== stdName) {
            b.name = stdName;
            await b.save();
          }
          canonicalBranchesByNormName.set(normKey, b);
        } else {
          // Duplicate branch found
          const canonical = canonicalBranchesByNormName.get(normKey);
          branchIdRedirectMap.set(b._id.toString(), canonical._id);
          branchesToDelete.push(b);
        }
      }

      // Delete duplicate branches from database and remap any member references
      for (const dup of branchesToDelete) {
        const canonicalId = branchIdRedirectMap.get(dup._id.toString());
        if (canonicalId) {
          for (const m of members) {
            let memberUpdated = false;
            if (m.branchIds && m.branchIds.some((id: any) => id.toString() === dup._id.toString())) {
              m.branchIds = m.branchIds.map((id: any) =>
                id.toString() === dup._id.toString() ? canonicalId : id
              );
              const uniqueIds = Array.from(new Set(m.branchIds.map((id: any) => id.toString()))).map(
                (idStr) => new Types.ObjectId(idStr)
              );
              m.branchIds = uniqueIds;
              memberUpdated = true;
            }
            if ((m as any).branchName) {
              const formattedMemberBranch = formatStandardBranchName((m as any).branchName);
              if ((m as any).branchName !== formattedMemberBranch) {
                (m as any).branchName = formattedMemberBranch;
                memberUpdated = true;
              }
            }
            if (memberUpdated) {
              await m.save();
            }
          }
        }
        await Branch.deleteOne({ _id: dup._id });
      }

      const relationships = await relationshipRepository.findByFamilyId(familyId);

      // Maps for spouse and children
      const spousesByMember = new Map<string, Set<string>>();
      const childrenByMember = new Map<string, Set<string>>();

      for (const rel of relationships) {
        const src = rel.sourceMemberId.toString();
        const tgt = rel.targetMemberId.toString();

        if (rel.relationshipType === 'SPOUSE') {
          if (!spousesByMember.has(src)) spousesByMember.set(src, new Set());
          if (!spousesByMember.has(tgt)) spousesByMember.set(tgt, new Set());
          spousesByMember.get(src)!.add(tgt);
          spousesByMember.get(tgt)!.add(src);
        } else if (
          rel.relationshipType === 'PARENT' ||
          rel.relationshipType === 'ADOPTIVE_PARENT' ||
          rel.relationshipType === 'STEP_PARENT'
        ) {
          // src is parent, tgt is child
          if (!childrenByMember.has(src)) childrenByMember.set(src, new Set());
          childrenByMember.get(src)!.add(tgt);
        } else if (
          rel.relationshipType === 'CHILD' ||
          rel.relationshipType === 'ADOPTED_CHILD' ||
          rel.relationshipType === 'STEP_CHILD'
        ) {
          // tgt is parent, src is child
          if (!childrenByMember.has(tgt)) childrenByMember.set(tgt, new Set());
          childrenByMember.get(tgt)!.add(src);
        }
      }

      // Sort members by generation ascending so parent branches are established before child branches override them
      const sortedMembers = [...members].sort((a, b) => (a.generation || 1) - (b.generation || 1));

      // Check each member: does this person have both a spouse and a child?
      for (const member of sortedMembers) {
        const memId = member._id.toString();
        const memberSpouses = spousesByMember.get(memId);
        const memberChildren = childrenByMember.get(memId);

        const hasSpouse = Boolean(memberSpouses && memberSpouses.size > 0);
        const hasChild = Boolean(memberChildren && memberChildren.size > 0);

        if (hasSpouse && hasChild) {
          const rawMemberName = (member.displayName || `${member.firstName} ${member.lastName}`).trim();
          const branchName = formatStandardBranchName(rawMemberName);
          const normKey = branchName.toLowerCase();

          // Check if branch already exists for this member or name
          let branch = canonicalBranchesByNormName.get(normKey);
          if (!branch) {
            branch = await Branch.findOne({
              familyId: familyOid,
              $or: [
                { rootMemberId: member._id },
                { name: branchName },
              ],
            });
          }

          if (!branch) {
            branch = await Branch.create({
              familyId: familyOid,
              name: branchName,
              description: `Dedicated lineage branch established for ${rawMemberName} and descendants.`,
              rootMemberId: member._id,
              accentColor: '#2563EB',
              createdBy: context?.userId || 'system',
              visibility: BranchVisibility.FAMILY,
            });
            canonicalBranchesByNormName.set(normKey, branch);
          } else if (branch.name !== branchName) {
            branch.name = branchName;
            await branch.save();
            canonicalBranchesByNormName.set(normKey, branch);
          }

          const branchOid = branch._id;

          // 1. Immediate Reassignment on the member themselves (overwrite inherited parent branch)
          if (!member.branchIds || member.branchIds.length !== 1 || member.branchIds[0].toString() !== branchOid.toString() || (member as any).branchName !== branchName) {
            member.branchIds = [branchOid];
            (member as any).branchName = branchName;
            await member.save();
          }

          // 2. Immediate Reassignment on spouse(s)
          for (const spouseId of memberSpouses!) {
            const spouseMember = members.find((m) => m._id.toString() === spouseId);
            if (spouseMember) {
              if (!spouseMember.branchIds || spouseMember.branchIds.length !== 1 || spouseMember.branchIds[0].toString() !== branchOid.toString() || (spouseMember as any).branchName !== branchName) {
                spouseMember.branchIds = [branchOid];
                (spouseMember as any).branchName = branchName;
                await spouseMember.save();
              }
            }
          }

          // 3. Immediate Reassignment on direct children (and descendants unless child has their own spouse+child)
          const queue = Array.from(memberChildren!);
          const visited = new Set<string>();
          while (queue.length > 0) {
            const childId = queue.shift()!;
            if (visited.has(childId)) continue;
            visited.add(childId);

            const childMember = members.find((m) => m._id.toString() === childId);
            if (childMember) {
              const childHasSpouse = (spousesByMember.get(childId)?.size ?? 0) > 0;
              const childHasChildren = (childrenByMember.get(childId)?.size ?? 0) > 0;
              // If child does not have their own spouse+child, overwrite to parent's branch
              if (!childHasSpouse || !childHasChildren) {
                if (!childMember.branchIds || childMember.branchIds.length !== 1 || childMember.branchIds[0].toString() !== branchOid.toString() || (childMember as any).branchName !== branchName) {
                  childMember.branchIds = [branchOid];
                  (childMember as any).branchName = branchName;
                  await childMember.save();
                }
                const grandChildren = childrenByMember.get(childId);
                if (grandChildren) {
                  queue.push(...Array.from(grandChildren));
                }
              }
            }
          }
        }
      }

      // Final pass: ensure all members have clean branchName format
      for (const m of members) {
        if ((m as any).branchName) {
          const std = formatStandardBranchName((m as any).branchName);
          if ((m as any).branchName !== std) {
            (m as any).branchName = std;
            await m.save();
          }
        }
      }
    } catch (err) {
      console.warn('Error during automatic branch creation/sync:', err);
    }
  }
}

export const branchService = new BranchService();
