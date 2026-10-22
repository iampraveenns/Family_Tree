import { Types } from 'mongoose';
import { Memory, IMemory } from '../models/Memory.ts';
import { Media } from '../models/Media.ts';
import { MemoryType, MemoryVisibility, MemoryStatus } from '../constants/index.ts';

export interface MemoryFilterOptions {
  page?: number;
  limit?: number;
  type?: MemoryType;
  memberId?: string;
  branchId?: string;
  year?: number;
  tag?: string;
  collectionId?: string;
  visibility?: MemoryVisibility;
  search?: string;
  status?: MemoryStatus;
  allowedVisibilities?: MemoryVisibility[];
  allowedBranchIds?: string[];
  actorUserId?: string;
  isOwnerOrAdmin?: boolean;
}

export interface PaginatedMemoriesResult {
  memories: (IMemory & { coverMedia?: any; mediaCount?: number })[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class MemoryRepository {
  async create(data: Partial<IMemory>): Promise<IMemory> {
    return Memory.create(data);
  }

  async findById(id: string | Types.ObjectId): Promise<IMemory | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Memory.findById(id)
      .populate('createdBy', 'displayName email avatar')
      .populate('addedByMemberId', 'firstName lastName displayName profilePhoto gender')
      .populate('memberIds', 'firstName lastName displayName profilePhoto gender isLiving dateOfBirth dateOfDeath generation')
      .populate('branchIds', 'name accentColor')
      .populate('coverMediaId');
  }

  async update(id: string | Types.ObjectId, data: Partial<IMemory>): Promise<IMemory | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Memory.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .populate('createdBy', 'displayName email avatar')
      .populate('addedByMemberId', 'firstName lastName displayName profilePhoto gender')
      .populate('memberIds', 'firstName lastName displayName profilePhoto gender isLiving dateOfBirth dateOfDeath generation')
      .populate('branchIds', 'name accentColor')
      .populate('coverMediaId');
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await Memory.findByIdAndDelete(id);
    return !!res;
  }

  async archive(id: string | Types.ObjectId): Promise<IMemory | null> {
    return this.update(id, { status: MemoryStatus.ARCHIVED });
  }

  async findWithFilters(
    familyId: string | Types.ObjectId,
    options: MemoryFilterOptions
  ): Promise<PaginatedMemoriesResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      familyId: new Types.ObjectId(familyId),
      status: options.status || MemoryStatus.ACTIVE,
    };

    // Filter by type
    if (options.type) {
      query.memoryType = options.type;
    }

    // Filter by member
    if (options.memberId && Types.ObjectId.isValid(options.memberId)) {
      query.memberIds = new Types.ObjectId(options.memberId);
    }

    // Filter by branch
    if (options.branchId && Types.ObjectId.isValid(options.branchId)) {
      query.branchIds = new Types.ObjectId(options.branchId);
    }

    // Filter by tag
    if (options.tag) {
      query.tags = options.tag.toLowerCase();
    }

    // Filter by collection
    if (options.collectionId && Types.ObjectId.isValid(options.collectionId)) {
      query.collectionIds = new Types.ObjectId(options.collectionId);
    }

    // Filter by year
    if (options.year && !isNaN(options.year)) {
      const startOfYear = new Date(Date.UTC(options.year, 0, 1));
      const endOfYear = new Date(Date.UTC(options.year, 11, 31, 23, 59, 59, 999));
      query.eventDate = { $gte: startOfYear, $lte: endOfYear };
    }

    // Filter by explicit visibility parameter if provided
    if (options.visibility) {
      query.visibility = options.visibility;
    }

    // Text search across title, description, and location
    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { tags: searchRegex },
      ];
    }

    // Visibility Scoping:
    // If not Owner/Admin, enforce privacy rules
    if (!options.isOwnerOrAdmin && options.actorUserId) {
      const actorOid = new Types.ObjectId(options.actorUserId);
      const allowedBranchOids = (options.allowedBranchIds || []).map((b) => new Types.ObjectId(b));

      const visibilityConditions: any[] = [
        { visibility: MemoryVisibility.PUBLIC },
        { visibility: MemoryVisibility.FAMILY },
        { visibility: MemoryVisibility.PRIVATE, createdBy: actorOid },
      ];

      if (allowedBranchOids.length > 0) {
        visibilityConditions.push({
          visibility: MemoryVisibility.BRANCH,
          branchIds: { $in: allowedBranchOids },
        });
      }

      // Add visibility scoping to existing query
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: visibilityConditions }];
        delete query.$or;
      } else {
        query.$or = visibilityConditions;
      }
    }

    const [total, rawMemories] = await Promise.all([
      Memory.countDocuments(query),
      Memory.find(query)
        .sort({ eventDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'displayName email avatar')
        .populate('addedByMemberId', 'firstName lastName displayName profilePhoto gender')
        .populate('memberIds', 'firstName lastName displayName profilePhoto gender')
        .populate('branchIds', 'name accentColor')
        .populate('coverMediaId')
        .lean(),
    ]);

    // Attach media count and fallback cover photo if not explicitly set
    const memoryIds = rawMemories.map((m) => m._id);
    const mediaCounts = await Media.aggregate([
      { $match: { memoryId: { $in: memoryIds }, status: MemoryStatus.ACTIVE } },
      { $group: { _id: '$memoryId', count: { $sum: 1 }, firstMedia: { $first: '$$ROOT' } } },
    ]);

    const mediaMap = new Map(mediaCounts.map((mc) => [mc._id.toString(), mc]));

    const enrichedMemories = rawMemories.map((m: any) => {
      const mInfo = mediaMap.get(m._id.toString());
      const rawCover = m.coverMediaId || mInfo?.firstMedia || null;
      let coverMediaObj = rawCover;
      if (rawCover && (rawCover._id || rawCover.id)) {
        const medId = (rawCover._id || rawCover.id).toString();
        coverMediaObj = {
          ...rawCover,
          id: medId,
          streamUrl: `/api/media/${medId}/stream`,
          thumbnailUrl: `/api/media/${medId}/stream`,
        };
      }
      return {
        ...m,
        id: m._id.toString(),
        mediaCount: mInfo?.count || 0,
        coverMedia: coverMediaObj,
        coverMediaUrl: coverMediaObj?.streamUrl || null,
      };
    });

    return {
      memories: enrichedMemories,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getStats(familyId: string | Types.ObjectId) {
    const famOid = new Types.ObjectId(familyId);

    const [typeCounts, totalMemories, totalMedia, taggedMembersAgg] = await Promise.all([
      Memory.aggregate([
        { $match: { familyId: famOid, status: MemoryStatus.ACTIVE } },
        { $group: { _id: '$memoryType', count: { $sum: 1 } } },
      ]),
      Memory.countDocuments({ familyId: famOid, status: MemoryStatus.ACTIVE }),
      Media.countDocuments({ familyId: famOid, status: MemoryStatus.ACTIVE }),
      Memory.aggregate([
        { $match: { familyId: famOid, status: MemoryStatus.ACTIVE } },
        { $unwind: '$memberIds' },
        { $group: { _id: '$memberIds' } },
        { $count: 'uniqueMembers' },
      ]),
    ]);

    const countsByType: Record<string, number> = {};
    for (const t of Object.values(MemoryType)) {
      countsByType[t] = 0;
    }
    for (const row of typeCounts) {
      if (countsByType[row._id] !== undefined) {
        countsByType[row._id] = row.count;
      }
    }

    return {
      totalMemories,
      totalMedia,
      uniqueTaggedMembers: taggedMembersAgg[0]?.uniqueMembers || 0,
      countsByType,
    };
  }

  async getOnThisDay(
    familyId: string | Types.ObjectId,
    month: number,
    day: number,
    options?: { actorUserId?: string; isOwnerOrAdmin?: boolean; allowedBranchIds?: string[] }
  ) {
    const famOid = new Types.ObjectId(familyId);

    const query: any = {
      familyId: famOid,
      status: MemoryStatus.ACTIVE,
      eventDate: { $ne: null },
      $expr: {
        $and: [
          { $eq: [{ $month: '$eventDate' }, month] },
          { $eq: [{ $dayOfMonth: '$eventDate' }, day] },
        ],
      },
    };

    if (options && !options.isOwnerOrAdmin && options.actorUserId) {
      const actorOid = new Types.ObjectId(options.actorUserId);
      const allowedBranchOids = (options.allowedBranchIds || []).map((b) => new Types.ObjectId(b));

      const visibilityConditions: any[] = [
        { visibility: MemoryVisibility.PUBLIC },
        { visibility: MemoryVisibility.FAMILY },
        { visibility: MemoryVisibility.PRIVATE, createdBy: actorOid },
      ];

      if (allowedBranchOids.length > 0) {
        visibilityConditions.push({
          visibility: MemoryVisibility.BRANCH,
          branchIds: { $in: allowedBranchOids },
        });
      }

      query.$and = [{ $expr: query.$expr }, { $or: visibilityConditions }];
      delete query.$expr;
    }

    return Memory.find(query)
      .sort({ eventDate: 1 })
      .populate('memberIds', 'firstName lastName displayName profilePhoto')
      .populate('coverMediaId')
      .lean();
  }

  async findByMember(familyId: string | Types.ObjectId, memberId: string | Types.ObjectId, limit = 5) {
    return Memory.find({
      familyId: new Types.ObjectId(familyId),
      memberIds: new Types.ObjectId(memberId),
      status: MemoryStatus.ACTIVE,
    })
      .sort({ eventDate: -1, createdAt: -1 })
      .limit(limit)
      .populate('coverMediaId')
      .lean();
  }
}

export const memoryRepository = new MemoryRepository();
