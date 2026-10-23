import { Types } from 'mongoose';
import { FamilyMember } from '../models/FamilyMember.ts';
import { memoryRepository, MemoryFilterOptions } from '../repositories/memoryRepository.ts';
import { mediaRepository } from '../repositories/mediaRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { authorizationService } from './authorizationService.ts';
import { auditService } from './auditService.ts';
import { getMediaStorageService } from './storage/MediaStorageService.ts';
import {
  AuditAction,
  MemoryType,
  MemoryVisibility,
  MemoryStatus,
  Permission,
  Role,
  normalizeRole,
} from '../constants/index.ts';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../utils/errors.ts';

export interface CreateMemoryInput {
  title: string;
  description?: string;
  memoryType: MemoryType;
  eventDate?: string | Date;
  eventDateApprox?: string;
  location?: string;
  visibility?: MemoryVisibility;
  memberIds?: string[];
  branchIds?: string[];
  tags?: string[];
  coverMediaId?: string;
  addedByMemberId?: string;
  addedByMemberName?: string;
}

export interface UpdateMemoryInput {
  title?: string;
  description?: string;
  memoryType?: MemoryType;
  eventDate?: string | Date | null;
  eventDateApprox?: string;
  location?: string;
  visibility?: MemoryVisibility;
  memberIds?: string[];
  branchIds?: string[];
  tags?: string[];
  coverMediaId?: string | null;
  status?: MemoryStatus;
  addedByMemberId?: string;
  addedByMemberName?: string;
}

export class MemoryService {
  async createMemory(
    familyId: string,
    actorUserId: string,
    input: CreateMemoryInput
  ) {
    if (!input.title || !input.title.trim()) {
      throw new ValidationError('Memory title is required');
    }

    if (!input.memoryType || !Object.values(MemoryType).includes(input.memoryType)) {
      throw new ValidationError(`Invalid memory type: ${input.memoryType}`);
    }

    // RBAC check
    const authResult = await authorizationService.canCreateMemory(actorUserId, familyId);
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason || 'Insufficient permissions to create memory in this family');
    }

    // Validate member IDs belong to family
    const memberOids: Types.ObjectId[] = [];
    if (input.memberIds && input.memberIds.length > 0) {
      for (const mId of input.memberIds) {
        if (mId && Types.ObjectId.isValid(mId)) {
          const member = await memberRepository.findById(mId);
          if (member && member.familyId.toString() === familyId) {
            memberOids.push(new Types.ObjectId(mId));
          }
        }
      }
    }

    // Validate branch IDs belong to family
    const branchOids: Types.ObjectId[] = [];
    if (input.branchIds && input.branchIds.length > 0) {
      for (const bId of input.branchIds) {
        if (bId && Types.ObjectId.isValid(bId)) {
          const branch = await branchRepository.findById(bId);
          if (branch && branch.familyId.toString() === familyId) {
            branchOids.push(new Types.ObjectId(bId));
          }
        }
      }
    }

    // Clean tags
    const normalizedTags = (input.tags || [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const parsedDate = input.eventDate ? new Date(input.eventDate) : undefined;

    // Resolve authoring member
    let authorMemberId: Types.ObjectId | undefined = undefined;
    let authorMemberName: string | undefined = input.addedByMemberName?.trim();

    if (input.addedByMemberId && Types.ObjectId.isValid(input.addedByMemberId)) {
      const authorMember = await memberRepository.findById(input.addedByMemberId);
      if (authorMember) {
        authorMemberId = new Types.ObjectId(input.addedByMemberId);
        if (!authorMemberName) {
          authorMemberName = authorMember.displayName || `${authorMember.firstName} ${authorMember.lastName}`.trim();
        }
      }
    }

    // If authorMemberId not yet resolved but author name is provided, match member by name in this family
    if (!authorMemberId && authorMemberName) {
      const cleanName = authorMemberName.trim();
      const matched = await FamilyMember.findOne({
        familyId: new Types.ObjectId(familyId),
        $or: [
          { displayName: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { firstName: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$firstName', ' ', '$lastName'] },
                regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                options: 'i',
              },
            },
          },
        ],
      }).exec();

      if (matched) {
        authorMemberId = matched._id;
        authorMemberName = matched.displayName || `${matched.firstName} ${matched.lastName}`.trim();
        if (!memberOids.some((oid) => oid.toString() === matched._id.toString())) {
          memberOids.push(matched._id);
        }
      }
    }

    if (!authorMemberId && memberOids.length > 0) {
      authorMemberId = memberOids[0];
      const m = await memberRepository.findById(memberOids[0].toString());
      if (m && !authorMemberName) {
        authorMemberName = m.displayName || `${m.firstName} ${m.lastName}`.trim();
      }
    }

    const memory = await memoryRepository.create({
      familyId: new Types.ObjectId(familyId),
      title: input.title.trim(),
      description: input.description?.trim() || '',
      memoryType: input.memoryType,
      createdBy: new Types.ObjectId(actorUserId),
      addedByMemberId: authorMemberId,
      addedByMemberName: authorMemberName,
      eventDate: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined,
      eventDateApprox: input.eventDateApprox?.trim(),
      location: input.location?.trim(),
      visibility: input.visibility || MemoryVisibility.FAMILY,
      memberIds: memberOids,
      branchIds: branchOids,
      tags: Array.from(new Set(normalizedTags)),
      status: MemoryStatus.ACTIVE,
    });

    // Audit logs
    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEMORY_CREATED,
      'Memory',
      memory._id.toString(),
      {
        title: memory.title,
        memoryType: memory.memoryType,
        visibility: memory.visibility,
        memberCount: memberOids.length,
      }
    );

    if (memberOids.length > 0) {
      await auditService.log(
        familyId,
        actorUserId,
        AuditAction.MEMBER_TAGGED_IN_MEMORY,
        'Memory',
        memory._id.toString(),
        {
          taggedMemberIds: memberOids.map((id) => id.toString()),
        }
      );
    }

    return memory;
  }

  async getMemories(
    familyId: string,
    actorUserId: string,
    filters: MemoryFilterOptions
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Active membership required to browse family memories');
    }

    const isOwnerOrAdmin =
      normalizeRole(membership.role) === Role.ADMIN;

    let allowedBranchIds: string[] = [];
    if (!isOwnerOrAdmin && membership.memberId) {
      const member = await memberRepository.findById(membership.memberId);
      if (member && member.branchIds) {
        allowedBranchIds = member.branchIds.map((b) => b.toString());
      }
    }

    const result = await memoryRepository.findWithFilters(familyId, {
      ...filters,
      actorUserId,
      isOwnerOrAdmin,
      allowedBranchIds,
    });

    // Generate signed URLs for cover media
    const storageService = getMediaStorageService();
    const enrichedMemories = result.memories.map((m: any) => {
      if (m.coverMedia) {
        return {
          ...m,
          coverMediaUrl: storageService.generateSignedUrl(m.coverMedia._id.toString(), {
            isThumbnail: true,
          }),
        };
      }
      return m;
    });

    return {
      ...result,
      memories: enrichedMemories,
    };
  }

  async getMemoryById(familyId: string, memoryId: string, actorUserId: string) {
    const memory = await memoryRepository.findById(memoryId);
    if (!memory) {
      throw new NotFoundError('Memory not found');
    }

    if (memory.familyId.toString() !== familyId) {
      throw new ForbiddenError('Memory does not belong to this family space');
    }

    const authResult = await authorizationService.canViewMemory(actorUserId, familyId, memory);
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason || 'Not authorized to view this memory');
    }

    // Retrieve media items associated with this memory
    const mediaList = await mediaRepository.findByMemory(memoryId);
    const storageService = getMediaStorageService();

    const signedMedia = mediaList.map((media) => ({
      ...media,
      streamUrl: storageService.generateSignedUrl(media._id.toString(), { isThumbnail: false }),
      thumbnailUrl: media.thumbnailStorageKey
        ? storageService.generateSignedUrl(media._id.toString(), { isThumbnail: true })
        : undefined,
    }));

    return {
      ...memory.toObject(),
      media: signedMedia,
    };
  }

  async updateMemory(
    familyId: string,
    memoryId: string,
    actorUserId: string,
    input: UpdateMemoryInput
  ) {
    const memory = await memoryRepository.findById(memoryId);
    if (!memory) {
      throw new NotFoundError('Memory not found');
    }

    const authResult = await authorizationService.canManageMemory(
      actorUserId,
      familyId,
      memory,
      Permission.EDIT_MEMORY
    );
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason || 'Insufficient authority to edit this memory');
    }

    const updates: Partial<any> = {};

    if (input.title !== undefined) {
      if (!input.title.trim()) {
        throw new ValidationError('Title cannot be empty');
      }
      updates.title = input.title.trim();
    }

    if (input.description !== undefined) {
      updates.description = input.description.trim();
    }

    if (input.memoryType !== undefined) {
      if (!Object.values(MemoryType).includes(input.memoryType)) {
        throw new ValidationError(`Invalid memory type: ${input.memoryType}`);
      }
      updates.memoryType = input.memoryType;
    }

    if (input.eventDate !== undefined) {
      if (input.eventDate === null) {
        updates.eventDate = null;
      } else {
        const parsed = new Date(input.eventDate);
        updates.eventDate = !isNaN(parsed.getTime()) ? parsed : null;
      }
    }

    if (input.eventDateApprox !== undefined) {
      updates.eventDateApprox = input.eventDateApprox.trim();
    }

    if (input.location !== undefined) {
      updates.location = input.location.trim();
    }

    if (input.visibility !== undefined && input.visibility !== memory.visibility) {
      updates.visibility = input.visibility;
      await auditService.log(
        familyId,
        actorUserId,
        AuditAction.MEMORY_VISIBILITY_CHANGED,
        'Memory',
        memoryId,
        {
          previousVisibility: memory.visibility,
          newVisibility: input.visibility,
        }
      );
    }

    if (input.memberIds !== undefined) {
      const memberOids: Types.ObjectId[] = [];
      for (const mId of input.memberIds) {
        if (!Types.ObjectId.isValid(mId)) {
          throw new ValidationError(`Invalid member ID: ${mId}`);
        }
        const member = await memberRepository.findById(mId);
        if (!member || member.familyId.toString() !== familyId) {
          throw new ValidationError(`Tagged member ${mId} not found in this family`);
        }
        memberOids.push(new Types.ObjectId(mId));
      }
      updates.memberIds = memberOids;

      const previousMemberStrs = new Set((memory.memberIds || []).map((m) => m._id?.toString() || m.toString()));
      const newlyTagged = input.memberIds.filter((id) => !previousMemberStrs.has(id));
      if (newlyTagged.length > 0) {
        await auditService.log(
          familyId,
          actorUserId,
          AuditAction.MEMBER_TAGGED_IN_MEMORY,
          'Memory',
          memoryId,
          { newlyTagged }
        );
      }
    }

    if (input.branchIds !== undefined) {
      const branchOids: Types.ObjectId[] = [];
      for (const bId of input.branchIds) {
        if (!Types.ObjectId.isValid(bId)) {
          throw new ValidationError(`Invalid branch ID: ${bId}`);
        }
        branchOids.push(new Types.ObjectId(bId));
      }
      updates.branchIds = branchOids;
    }

    if (input.tags !== undefined) {
      updates.tags = Array.from(
        new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
      );
    }

    if (input.coverMediaId !== undefined) {
      updates.coverMediaId = input.coverMediaId ? new Types.ObjectId(input.coverMediaId) : null;
    }

    if (input.status !== undefined && input.status !== memory.status) {
      updates.status = input.status;
      if (input.status === MemoryStatus.ARCHIVED) {
        await auditService.log(
          familyId,
          actorUserId,
          AuditAction.MEMORY_ARCHIVED,
          'Memory',
          memoryId,
          { reason: 'Archived by user' }
        );
      }
    }

    const updated = await memoryRepository.update(memoryId, updates);

    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEMORY_UPDATED,
      'Memory',
      memoryId,
      { updatedFields: Object.keys(updates) }
    );

    return updated;
  }

  async deleteMemory(familyId: string, memoryId: string, actorUserId: string) {
    const memory = await memoryRepository.findById(memoryId);
    if (!memory) {
      throw new NotFoundError('Memory not found');
    }

    const authResult = await authorizationService.canManageMemory(
      actorUserId,
      familyId,
      memory,
      Permission.DELETE_MEMORY
    );
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason || 'Insufficient permissions to delete this memory');
    }

    // Soft-delete / Archive memory
    await memoryRepository.archive(memoryId);

    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEMORY_ARCHIVED,
      'Memory',
      memoryId,
      { title: memory.title }
    );

    return { success: true, message: 'Memory successfully archived' };
  }

  async getStats(familyId: string, actorUserId: string) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Active membership required to view memory stats');
    }

    return memoryRepository.getStats(familyId);
  }

  async getOnThisDay(familyId: string, actorUserId: string) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Active membership required to access historic memories');
    }

    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate(); // 1-31

    const isOwnerOrAdmin =
      normalizeRole(membership.role) === Role.ADMIN;
    const allowedBranchIds = membership.branchId ? [membership.branchId.toString()] : [];

    const memories = await memoryRepository.getOnThisDay(familyId, month, day, {
      actorUserId,
      isOwnerOrAdmin,
      allowedBranchIds,
    });
    const storageService = getMediaStorageService();

    return memories.map((m: any) => {
      if (m.coverMediaId) {
        return {
          ...m,
          coverMediaUrl: storageService.generateSignedUrl(m.coverMediaId._id.toString(), {
            isThumbnail: true,
          }),
        };
      }
      return m;
    });
  }
}

export const memoryService = new MemoryService();
