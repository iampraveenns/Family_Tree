import { Types } from 'mongoose';
import { FamilyEvent, IFamilyEvent } from '../models/FamilyEvent.ts';
import { EventType, EventVisibility } from '../constants/index.ts';

export interface TimelineFilterOptions {
  page?: number;
  limit?: number;
  eventType?: EventType;
  memberId?: string;
  branchId?: string;
  year?: number;
  era?: string;
  search?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  view?: 'ALL' | 'MEMBER' | 'BRANCH' | 'GENERATION';
  generation?: number;
  allowedBranchIds?: string[];
  actorUserId?: string;
  isOwnerOrAdmin?: boolean;
}

export interface PaginatedTimelineResult {
  events: IFamilyEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  eras: string[];
}

export class EventRepository {
  async create(data: Partial<IFamilyEvent>): Promise<IFamilyEvent> {
    return FamilyEvent.create(data);
  }

  async findById(id: string | Types.ObjectId): Promise<IFamilyEvent | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyEvent.findById(id)
      .populate('createdBy', 'displayName email avatar')
      .populate('memberIds', 'firstName lastName displayName profilePhoto gender isLiving dateOfBirth dateOfDeath generation')
      .populate('branchIds', 'name accentColor')
      .populate('coverMediaId', 'thumbnailStorageKey storageKey mimeType fileSize')
      .populate({
        path: 'memoryIds',
        select: 'title description memoryType coverMediaId eventDate eventDateApprox location',
        populate: {
          path: 'coverMediaId',
          select: 'thumbnailStorageKey storageKey mimeType fileSize',
        },
      });
  }

  async update(id: string | Types.ObjectId, data: Partial<IFamilyEvent>): Promise<IFamilyEvent | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyEvent.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true })
      .populate('createdBy', 'displayName email avatar')
      .populate('memberIds', 'firstName lastName displayName profilePhoto gender isLiving dateOfBirth dateOfDeath generation')
      .populate('branchIds', 'name accentColor')
      .populate('coverMediaId', 'thumbnailStorageKey storageKey mimeType fileSize')
      .populate({
        path: 'memoryIds',
        select: 'title description memoryType coverMediaId eventDate eventDateApprox location',
        populate: {
          path: 'coverMediaId',
          select: 'thumbnailStorageKey storageKey mimeType fileSize',
        },
      });
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await FamilyEvent.findByIdAndDelete(id);
    return !!res;
  }

  async findTimelineEvents(
    familyId: string | Types.ObjectId,
    options: TimelineFilterOptions = {}
  ): Promise<PaginatedTimelineResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 30));
    const skip = (page - 1) * limit;

    const filter: any = {
      familyId: new Types.ObjectId(familyId),
      status: options.status || 'ACTIVE',
    };

    if (options.eventType) {
      filter.eventType = options.eventType;
    }

    if (options.memberId && Types.ObjectId.isValid(options.memberId)) {
      filter.memberIds = new Types.ObjectId(options.memberId);
    }

    if (options.branchId && Types.ObjectId.isValid(options.branchId)) {
      filter.branchIds = new Types.ObjectId(options.branchId);
    }

    if (options.era) {
      filter.era = new RegExp(options.era, 'i');
    }

    if (options.year) {
      const startOfYear = new Date(Date.UTC(options.year, 0, 1));
      const endOfYear = new Date(Date.UTC(options.year + 1, 0, 1));
      filter.eventDate = { $gte: startOfYear, $lt: endOfYear };
    }

    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        { era: searchRegex },
        { approximateDate: searchRegex },
      ];
    }

    // RBAC and visibility rules
    if (!options.isOwnerOrAdmin) {
      const visibilityConditions: any[] = [
        { visibility: EventVisibility.FAMILY },
      ];

      if (options.allowedBranchIds && options.allowedBranchIds.length > 0) {
        visibilityConditions.push({
          visibility: EventVisibility.BRANCH,
          branchIds: { $in: options.allowedBranchIds.map((b) => new Types.ObjectId(b)) },
        });
      }

      if (options.actorUserId && Types.ObjectId.isValid(options.actorUserId)) {
        visibilityConditions.push({
          visibility: EventVisibility.PRIVATE,
          createdBy: new Types.ObjectId(options.actorUserId),
        });
      }

      filter.$and = filter.$and || [];
      filter.$and.push({ $or: visibilityConditions });
    }

    const [events, total] = await Promise.all([
      FamilyEvent.find(filter)
        .sort({ eventDate: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'displayName email avatar')
        .populate('memberIds', 'firstName lastName displayName profilePhoto gender isLiving dateOfBirth dateOfDeath generation')
        .populate('branchIds', 'name accentColor')
        .populate('coverMediaId', 'thumbnailStorageKey storageKey mimeType fileSize')
        .populate({
          path: 'memoryIds',
          select: 'title description memoryType coverMediaId eventDate eventDateApprox location',
          populate: {
            path: 'coverMediaId',
            select: 'thumbnailStorageKey storageKey mimeType fileSize',
          },
        }),
      FamilyEvent.countDocuments(filter),
    ]);

    // Distinct eras present in this family's events
    const distinctEras = await FamilyEvent.distinct('era', {
      familyId: new Types.ObjectId(familyId),
      status: 'ACTIVE',
      era: { $ne: '' },
    });

    return {
      events,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      eras: distinctEras.filter(Boolean),
    };
  }

  async findOnThisDay(familyId: string | Types.ObjectId, month: number, day: number): Promise<IFamilyEvent[]> {
    return FamilyEvent.aggregate([
      {
        $match: {
          familyId: new Types.ObjectId(familyId),
          status: 'ACTIVE',
          eventDate: { $exists: true, $ne: null },
          visibility: { $ne: EventVisibility.PRIVATE },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          eventType: 1,
          eventDate: 1,
          approximateDate: 1,
          era: 1,
          location: 1,
          memberIds: 1,
          branchIds: 1,
          memoryIds: 1,
          month: { $month: '$eventDate' },
          day: { $dayOfMonth: '$eventDate' },
        },
      },
      {
        $match: {
          month: month + 1, // $month is 1-indexed (1-12)
          day: day,
        },
      },
      { $limit: 10 },
    ]);
  }

  async findUpcomingAnniversaries(familyId: string | Types.ObjectId, limit = 10): Promise<IFamilyEvent[]> {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    return FamilyEvent.aggregate([
      {
        $match: {
          familyId: new Types.ObjectId(familyId),
          status: 'ACTIVE',
          eventType: { $in: [EventType.BIRTHDAY, EventType.ANNIVERSARY, EventType.MARRIAGE, EventType.DEATH] },
          eventDate: { $exists: true, $ne: null },
          visibility: { $ne: EventVisibility.PRIVATE },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          eventType: 1,
          eventDate: 1,
          location: 1,
          memberIds: 1,
          branchIds: 1,
          month: { $month: '$eventDate' },
          day: { $dayOfMonth: '$eventDate' },
        },
      },
      {
        $addFields: {
          daysAway: {
            $let: {
              vars: {
                targetDayOfYear: {
                  $add: [{ $multiply: [{ $subtract: ['$month', 1] }, 30.5] }, '$day'],
                },
                currentDayOfYear: (currentMonth - 1) * 30.5 + currentDay,
              },
              in: {
                $cond: [
                  { $gte: ['$$targetDayOfYear', '$$currentDayOfYear'] },
                  { $subtract: ['$$targetDayOfYear', '$$currentDayOfYear'] },
                  { $add: [{ $subtract: [365, '$$currentDayOfYear'] }, '$$targetDayOfYear'] },
                ],
              },
            },
          },
        },
      },
      { $sort: { daysAway: 1 } },
      { $limit: limit },
    ]);
  }

  async findMilestones(
    familyId: string | Types.ObjectId,
    options: {
      status?: 'ACTIVE' | 'ARCHIVED';
      eventType?: EventType | string;
      importance?: string;
      memberId?: string;
      branchId?: string;
      search?: string;
      allowedBranchIds?: string[];
      actorUserId?: string;
      isOwnerOrAdmin?: boolean;
      limit?: number;
    } = {}
  ): Promise<IFamilyEvent[]> {
    const filter: any = {
      familyId: new Types.ObjectId(familyId),
      status: options.status || 'ACTIVE',
    };

    if (options.eventType) {
      filter.eventType = options.eventType;
    }

    if (options.importance) {
      filter.importance = options.importance;
    }

    if (options.memberId && Types.ObjectId.isValid(options.memberId)) {
      filter.memberIds = new Types.ObjectId(options.memberId);
    }

    if (options.branchId && Types.ObjectId.isValid(options.branchId)) {
      filter.branchIds = new Types.ObjectId(options.branchId);
    }

    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { notes: searchRegex },
        { location: searchRegex },
      ];
    }

    // RBAC & Branch scoping:
    if (!options.isOwnerOrAdmin) {
      const visibilityConditions: any[] = [{ visibility: EventVisibility.FAMILY }];

      if (options.allowedBranchIds && options.allowedBranchIds.length > 0) {
        const branchOids = options.allowedBranchIds
          .filter((b) => Types.ObjectId.isValid(b))
          .map((b) => new Types.ObjectId(b));
        if (branchOids.length > 0) {
          visibilityConditions.push({
            visibility: EventVisibility.BRANCH,
            branchIds: { $in: branchOids },
          });
        }
      }

      if (options.actorUserId && Types.ObjectId.isValid(options.actorUserId)) {
        visibilityConditions.push({
          visibility: EventVisibility.PRIVATE,
          createdBy: new Types.ObjectId(options.actorUserId),
        });
      }

      filter.$and = filter.$and || [];
      filter.$and.push({ $or: visibilityConditions });
    }

    let query = FamilyEvent.find(filter)
      .sort({ eventDate: 1, createdAt: -1 })
      .populate('createdBy', 'displayName email avatar')
      .populate('memberIds', 'firstName lastName displayName profilePhoto gender isLiving dateOfBirth dateOfDeath generation')
      .populate('branchIds', 'name accentColor')
      .populate('coverMediaId', 'thumbnailStorageKey storageKey mimeType fileSize')
      .populate({
        path: 'memoryIds',
        select: 'title description memoryType coverMediaId eventDate eventDateApprox location',
        populate: {
          path: 'coverMediaId',
          select: 'thumbnailStorageKey storageKey mimeType fileSize',
        },
      });

    if (options.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    return query.exec();
  }
}

export const eventRepository = new EventRepository();
