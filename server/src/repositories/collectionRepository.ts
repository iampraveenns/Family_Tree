import { Types } from 'mongoose';
import { MemoryCollection, IMemoryCollection } from '../models/MemoryCollection.ts';
import { Memory } from '../models/Memory.ts';
import { Media } from '../models/Media.ts';
import { FamilyMember } from '../models/FamilyMember.ts';
import { MemoryStatus, MemoryVisibility } from '../constants/index.ts';
import { getMediaStorageService } from '../services/storage/MediaStorageService.ts';

export interface CollectionQueryOptions {
  actorUserId?: string;
  isOwnerOrAdmin?: boolean;
  allowedBranchIds?: string[];
}

export class CollectionRepository {
  async findByFamily(familyId: string | Types.ObjectId, options: CollectionQueryOptions = {}) {
    const famOid = new Types.ObjectId(familyId);

    const collections = await MemoryCollection.find({
      familyId: famOid,
      status: MemoryStatus.ACTIVE,
    })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      collections.map((col) => this.enrichCollection(col, options))
    );

    return enriched;
  }

  async findById(
    familyId: string | Types.ObjectId,
    collectionId: string | Types.ObjectId,
    options: CollectionQueryOptions = {}
  ) {
    const famOid = new Types.ObjectId(familyId);
    const colOid = new Types.ObjectId(collectionId);

    const col = await MemoryCollection.findOne({
      _id: colOid,
      familyId: famOid,
      status: MemoryStatus.ACTIVE,
    }).lean();

    if (!col) return null;

    return this.enrichCollection(col, options);
  }

  async create(data: {
    familyId: string | Types.ObjectId;
    title: string;
    description?: string;
    coverMediaId?: string | Types.ObjectId;
    coverImageUrl?: string;
    memoryIds?: (string | Types.ObjectId)[];
    createdBy: string | Types.ObjectId;
  }): Promise<IMemoryCollection> {
    const memoryOids = (data.memoryIds || []).map((m) => new Types.ObjectId(m));

    const collection = await MemoryCollection.create({
      familyId: new Types.ObjectId(data.familyId),
      title: data.title.trim(),
      description: data.description?.trim() || '',
      coverMediaId: data.coverMediaId ? new Types.ObjectId(data.coverMediaId) : undefined,
      coverImageUrl: data.coverImageUrl?.trim() || undefined,
      memoryIds: memoryOids,
      createdBy: new Types.ObjectId(data.createdBy),
      status: MemoryStatus.ACTIVE,
    });

    if (memoryOids.length > 0) {
      await Memory.updateMany(
        { _id: { $in: memoryOids } },
        { $addToSet: { collectionIds: collection._id } }
      );
    }

    return collection;
  }

  async update(
    collectionId: string | Types.ObjectId,
    data: {
      title?: string;
      description?: string;
      coverMediaId?: string | Types.ObjectId | null;
      coverImageUrl?: string | null;
      memoryIds?: (string | Types.ObjectId)[];
    }
  ) {
    const colOid = new Types.ObjectId(collectionId);
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl || undefined;
    if (data.coverMediaId !== undefined) {
      updateData.coverMediaId = data.coverMediaId ? new Types.ObjectId(data.coverMediaId) : undefined;
    }

    if (data.memoryIds !== undefined) {
      const memoryOids = data.memoryIds.map((m) => new Types.ObjectId(m));
      updateData.memoryIds = memoryOids;

      // Sync memory collectionIds
      await Memory.updateMany(
        { collectionIds: colOid },
        { $pull: { collectionIds: colOid } }
      );
      if (memoryOids.length > 0) {
        await Memory.updateMany(
          { _id: { $in: memoryOids } },
          { $addToSet: { collectionIds: colOid } }
        );
      }
    }

    return MemoryCollection.findByIdAndUpdate(colOid, updateData, { new: true });
  }

  async delete(collectionId: string | Types.ObjectId) {
    const colOid = new Types.ObjectId(collectionId);
    await Memory.updateMany(
      { collectionIds: colOid },
      { $pull: { collectionIds: colOid } }
    );
    return MemoryCollection.findByIdAndUpdate(
      colOid,
      { status: MemoryStatus.ARCHIVED },
      { new: true }
    );
  }

  async addMemory(collectionId: string | Types.ObjectId, memoryId: string | Types.ObjectId) {
    const colOid = new Types.ObjectId(collectionId);
    const memOid = new Types.ObjectId(memoryId);

    const updated = await MemoryCollection.findByIdAndUpdate(
      colOid,
      { $addToSet: { memoryIds: memOid } },
      { new: true }
    );

    await Memory.findByIdAndUpdate(memOid, {
      $addToSet: { collectionIds: colOid },
    });

    return updated;
  }

  async removeMemory(collectionId: string | Types.ObjectId, memoryId: string | Types.ObjectId) {
    const colOid = new Types.ObjectId(collectionId);
    const memOid = new Types.ObjectId(memoryId);

    const updated = await MemoryCollection.findByIdAndUpdate(
      colOid,
      { $pull: { memoryIds: memOid } },
      { new: true }
    );

    await Memory.findByIdAndUpdate(memOid, {
      $pull: { collectionIds: colOid },
    });

    return updated;
  }

  private async enrichCollection(col: any, options: CollectionQueryOptions) {
    const memoryOids = (col.memoryIds || []).map((m: any) =>
      m instanceof Types.ObjectId ? m : new Types.ObjectId(m)
    );

    if (memoryOids.length === 0) {
      return {
        ...col,
        id: col._id.toString(),
        memoryCount: 0,
        people: [],
        dateRange: undefined,
        coverImageUrl: col.coverImageUrl || null,
        memories: [],
      };
    }

    // Build privacy visibility query
    const memoryQuery: any = {
      _id: { $in: memoryOids },
      status: MemoryStatus.ACTIVE,
    };

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

      memoryQuery.$or = visibilityConditions;
    }

    const memories = await Memory.find(memoryQuery)
      .sort({ eventDate: 1, createdAt: 1 })
      .populate('coverMediaId')
      .populate('memberIds', 'firstName lastName displayName profilePhoto')
      .populate('createdBy', 'displayName email avatar')
      .lean();

    // Collect unique people
    const personMap = new Map<string, any>();
    const dates: Date[] = [];

    for (const mem of memories) {
      if (mem.eventDate) {
        dates.push(new Date(mem.eventDate));
      }
      if (Array.isArray(mem.memberIds)) {
        for (const member of mem.memberIds) {
          const m = member as any;
          if (m && (m._id || m.id)) {
            const mId = (m._id || m.id).toString();
            personMap.set(mId, {
              id: mId,
              firstName: m.firstName,
              lastName: m.lastName,
              displayName: m.displayName,
              profilePhoto: m.profilePhoto,
            });
          }
        }
      }
    }

    // Compute date range string
    let dateRange: string | undefined = undefined;
    if (dates.length > 0) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      const minYear = dates[0].getFullYear();
      const maxYear = dates[dates.length - 1].getFullYear();
      dateRange = minYear === maxYear ? `${minYear}` : `${minYear} – ${maxYear}`;
    }

    // Resolve cover image URL - strip out hardcoded unsplash stock images
    const storageService = getMediaStorageService();
    let coverImageUrl =
      col.coverImageUrl && !col.coverImageUrl.includes('unsplash.com') ? col.coverImageUrl : null;
    if (!coverImageUrl && col.coverMediaId) {
      try {
        const coverMedia = await Media.findById(col.coverMediaId).lean();
        if (coverMedia) {
          coverImageUrl = storageService.generateSignedUrl(coverMedia._id.toString(), {
            isThumbnail: true,
          });
        }
      } catch {
        coverImageUrl = `/api/media/${col.coverMediaId}/stream`;
      }
    }

    // If still no cover image, check memories
    if (!coverImageUrl && memories.length > 0) {
      for (const m of memories) {
        const cMed = m.coverMediaId as any;
        if (cMed && (cMed._id || cMed.id)) {
          const medId = (cMed._id || cMed.id).toString();
          coverImageUrl = storageService.generateSignedUrl(medId, { isThumbnail: true });
          break;
        }
      }
    }

    return {
      ...col,
      id: col._id.toString(),
      memoryCount: memories.length,
      people: Array.from(personMap.values()),
      dateRange,
      coverImageUrl,
      memories: memories.map((m: any) => ({
        ...m,
        id: m._id.toString(),
        coverMedia: m.coverMediaId,
      })),
    };
  }
}

export const collectionRepository = new CollectionRepository();
