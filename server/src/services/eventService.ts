import { Types } from 'mongoose';
import { eventRepository, TimelineFilterOptions } from '../repositories/eventRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { memoryRepository } from '../repositories/memoryRepository.ts';
import { authorizationService } from './authorizationService.ts';
import { auditService } from './auditService.ts';
import { getMediaStorageService } from './storage/MediaStorageService.ts';
import {
  AuditAction,
  EventType,
  EventVisibility,
  Permission,
  Role,
  RecurrenceFrequency,
  MilestoneImportance,
} from '../constants/index.ts';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../utils/errors.ts';

export interface CreateEventInput {
  title: string;
  description?: string;
  eventType: EventType;
  eventDate?: string | Date;
  approximateDate?: string;
  era?: string;
  location?: string;
  memberIds?: string[];
  branchIds?: string[];
  memoryIds?: string[];
  coverMediaId?: string;
  recurrence?: any;
  reminderSettings?: any;
  importance?: string;
  notes?: string;
  isMilestone?: boolean;
  visibility?: EventVisibility;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  eventType?: EventType;
  eventDate?: string | Date | null;
  approximateDate?: string;
  era?: string;
  location?: string;
  memberIds?: string[];
  branchIds?: string[];
  memoryIds?: string[];
  coverMediaId?: string | null;
  recurrence?: any;
  reminderSettings?: any;
  importance?: string;
  notes?: string;
  isMilestone?: boolean;
  visibility?: EventVisibility;
  status?: 'ACTIVE' | 'ARCHIVED';
}

export class EventService {
  /**
   * Helper to enrich memory items with signed media streaming and thumbnail URLs.
   */
  private enrichMemoriesWithSignedUrls(memories: any[]) {
    const storageService = getMediaStorageService();
    return memories.map((mem) => {
      const memoryObj = mem.toObject ? mem.toObject() : mem;
      if (memoryObj.coverMediaId) {
        const media = memoryObj.coverMediaId;
        const mediaId = (media._id || media.id || '').toString();
        if (mediaId) {
          media.streamUrl = storageService.generateSignedUrl(mediaId, { isThumbnail: false });
          media.thumbnailUrl = media.thumbnailStorageKey
            ? storageService.generateSignedUrl(mediaId, { isThumbnail: true })
            : media.streamUrl;
        }
      }
      return memoryObj;
    });
  }

  /**
   * Helper to enrich an event's cover media and attached memories with signed streaming & thumbnail URLs.
   */
  private enrichEventMedia(event: any) {
    if (!event) return event;
    const storageService = getMediaStorageService();
    const eventObj = event.toObject ? event.toObject() : { ...event };

    if (eventObj.coverMediaId) {
      const media = eventObj.coverMediaId;
      const mediaId = (media._id || media.id || '').toString();
      if (mediaId) {
        media.streamUrl = storageService.generateSignedUrl(mediaId, { isThumbnail: false });
        media.thumbnailUrl = media.thumbnailStorageKey
          ? storageService.generateSignedUrl(mediaId, { isThumbnail: true })
          : media.streamUrl;
      }
    }

    if (Array.isArray(eventObj.memoryIds) && eventObj.memoryIds.length > 0) {
      eventObj.memoryIds = this.enrichMemoriesWithSignedUrls(eventObj.memoryIds);
    }

    return eventObj;
  }

  async createEvent(
    familyId: string,
    actorUserId: string,
    input: CreateEventInput
  ) {
    if (!input.title || !input.title.trim()) {
      throw new ValidationError('Event title is required');
    }

    if (!input.eventType || !Object.values(EventType).includes(input.eventType)) {
      throw new ValidationError(`Valid event type is required: ${Object.values(EventType).join(', ')}`);
    }

    // RBAC: Require CREATE_EVENT permission
    await authorizationService.requirePermission(
      actorUserId,
      familyId,
      Permission.CREATE_EVENT
    );

    // Validate member IDs if provided (must belong to this family)
    const validMemberObjectIds: Types.ObjectId[] = [];
    if (input.memberIds && input.memberIds.length > 0) {
      for (const mId of input.memberIds) {
        if (Types.ObjectId.isValid(mId)) {
          const member = await memberRepository.findById(mId);
          if (!member || member.familyId.toString() !== familyId) {
            throw new ValidationError(`Member '${mId}' does not belong to this family`);
          }
          validMemberObjectIds.push(new Types.ObjectId(mId));
        }
      }
    }

    // Validate branch IDs if provided
    const validBranchObjectIds: Types.ObjectId[] = [];
    if (input.branchIds && input.branchIds.length > 0) {
      for (const bId of input.branchIds) {
        if (Types.ObjectId.isValid(bId)) {
          const branch = await branchRepository.findById(bId);
          if (!branch || branch.familyId.toString() !== familyId) {
            throw new ValidationError(`Branch '${bId}' does not belong to this family`);
          }
          validBranchObjectIds.push(new Types.ObjectId(bId));
        }
      }
    }

    // Validate memory IDs if provided
    const validMemoryObjectIds: Types.ObjectId[] = [];
    if (input.memoryIds && input.memoryIds.length > 0) {
      for (const memId of input.memoryIds) {
        if (Types.ObjectId.isValid(memId)) {
          const memory = await memoryRepository.findById(memId);
          if (!memory || memory.familyId.toString() !== familyId) {
            throw new ValidationError(`Memory '${memId}' does not belong to this family`);
          }
          validMemoryObjectIds.push(new Types.ObjectId(memId));
        }
      }
    }

    let parsedDate: Date | undefined;
    if (input.eventDate) {
      parsedDate = new Date(input.eventDate);
      if (isNaN(parsedDate.getTime())) {
        throw new ValidationError('Invalid eventDate provided');
      }
    }

    // Compute era if not explicitly provided
    let calculatedEra = input.era?.trim() || '';
    if (!calculatedEra && parsedDate) {
      const year = parsedDate.getFullYear();
      const decade = Math.floor(year / 10) * 10;
      calculatedEra = `${decade}s`;
    } else if (!calculatedEra && input.approximateDate) {
      calculatedEra = input.approximateDate.trim();
    }

    const event = await eventRepository.create({
      familyId: new Types.ObjectId(familyId),
      title: input.title.trim(),
      description: input.description?.trim() || '',
      eventType: input.eventType,
      eventDate: parsedDate,
      approximateDate: input.approximateDate?.trim() || '',
      era: calculatedEra,
      location: input.location?.trim() || '',
      memberIds: validMemberObjectIds,
      branchIds: validBranchObjectIds,
      memoryIds: validMemoryObjectIds,
      coverMediaId: input.coverMediaId && Types.ObjectId.isValid(input.coverMediaId) ? new Types.ObjectId(input.coverMediaId) : undefined,
      recurrence: input.recurrence || RecurrenceFrequency.NONE,
      reminderSettings: input.reminderSettings || { enabled: false, daysBefore: [1, 7], notifyChannels: ['EMAIL'] },
      importance: input.importance || MilestoneImportance.NORMAL,
      notes: input.notes?.trim() || '',
      isMilestone: input.isMilestone !== undefined ? input.isMilestone : true,
      createdBy: new Types.ObjectId(actorUserId),
      visibility: input.visibility || EventVisibility.FAMILY,
      status: 'ACTIVE',
    });

    // Write audit log
    await auditService.log(
      familyId,
      actorUserId,
      event.isMilestone ? AuditAction.MILESTONE_CREATED : AuditAction.EVENT_CREATED,
      'FamilyEvent',
      event._id.toString(),
      {
        title: event.title,
        eventType: event.eventType,
        eventDate: event.eventDate,
        importance: event.importance,
        recurrence: event.recurrence,
      }
    );

    return this.getEventById(familyId, event._id.toString(), actorUserId);
  }

  async getEventById(
    familyId: string,
    eventId: string,
    actorUserId: string
  ) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership) {
      throw new ForbiddenError('Active family membership is required to access events');
    }

    const event = await eventRepository.findById(eventId);
    if (!event || event.familyId.toString() !== familyId) {
      throw new NotFoundError('Family event not found');
    }

    // Check visibility
    const isOwnerOrAdmin = [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(membership.role);
    if (event.visibility === EventVisibility.PRIVATE && !isOwnerOrAdmin) {
      if (event.createdBy._id.toString() !== actorUserId) {
        throw new ForbiddenError('Private event can only be accessed by its creator');
      }
    }

    if (event.visibility === EventVisibility.BRANCH && !isOwnerOrAdmin) {
      const userBranchIds: string[] = [];
      if (membership.branchId) {
        userBranchIds.push(membership.branchId.toString());
      }
      if (membership.memberId) {
        const member = await memberRepository.findById(membership.memberId);
        if (member && member.branchIds) {
          userBranchIds.push(...member.branchIds.map((b) => b.toString()));
        }
      }
      const eventBranchIds = event.branchIds.map((b: any) => (b._id || b).toString());
      const hasBranchAccess = eventBranchIds.some((bId) => userBranchIds.includes(bId));
      if (!hasBranchAccess && event.createdBy._id.toString() !== actorUserId) {
        throw new ForbiddenError('This event is restricted to branch members');
      }
    }

    return this.enrichEventMedia(event);
  }

  async updateEvent(
    familyId: string,
    eventId: string,
    actorUserId: string,
    input: UpdateEventInput
  ) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership) {
      throw new ForbiddenError('Active family membership is required to update events');
    }

    const existingEvent = await eventRepository.findById(eventId);
    if (!existingEvent || existingEvent.familyId.toString() !== familyId) {
      throw new NotFoundError('Family event not found');
    }

    const isOwnerOrAdmin = [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(membership.role);
    const isCreator = existingEvent.createdBy._id.toString() === actorUserId;

    if (!isOwnerOrAdmin && !isCreator) {
      await authorizationService.requirePermission(
        actorUserId,
        familyId,
        Permission.EDIT_EVENT
      );
    }

    const updatePayload: any = {};
    if (input.title !== undefined) {
      if (!input.title.trim()) throw new ValidationError('Title cannot be empty');
      updatePayload.title = input.title.trim();
    }
    if (input.description !== undefined) updatePayload.description = input.description.trim();
    if (input.eventType !== undefined) {
      if (!Object.values(EventType).includes(input.eventType)) {
        throw new ValidationError('Invalid eventType');
      }
      updatePayload.eventType = input.eventType;
    }

    if (input.eventDate !== undefined) {
      if (input.eventDate === null) {
        updatePayload.eventDate = null;
      } else {
        const parsed = new Date(input.eventDate);
        if (isNaN(parsed.getTime())) throw new ValidationError('Invalid eventDate');
        updatePayload.eventDate = parsed;
      }
    }

    if (input.approximateDate !== undefined) updatePayload.approximateDate = input.approximateDate.trim();
    if (input.era !== undefined) updatePayload.era = input.era.trim();
    if (input.location !== undefined) updatePayload.location = input.location.trim();
    if (input.visibility !== undefined) updatePayload.visibility = input.visibility;
    if (input.status !== undefined) updatePayload.status = input.status;

    if (input.coverMediaId !== undefined) {
      updatePayload.coverMediaId = input.coverMediaId ? new Types.ObjectId(input.coverMediaId) : null;
    }
    if (input.recurrence !== undefined) updatePayload.recurrence = input.recurrence;
    if (input.reminderSettings !== undefined) updatePayload.reminderSettings = input.reminderSettings;
    if (input.importance !== undefined) updatePayload.importance = input.importance;
    if (input.notes !== undefined) updatePayload.notes = input.notes.trim();
    if (input.isMilestone !== undefined) updatePayload.isMilestone = input.isMilestone;

    if (input.memberIds !== undefined) {
      const validMemberObjectIds: Types.ObjectId[] = [];
      for (const mId of input.memberIds) {
        if (Types.ObjectId.isValid(mId)) {
          const member = await memberRepository.findById(mId);
          if (!member || member.familyId.toString() !== familyId) {
            throw new ValidationError(`Member '${mId}' does not belong to this family`);
          }
          validMemberObjectIds.push(new Types.ObjectId(mId));
        }
      }
      updatePayload.memberIds = validMemberObjectIds;
    }

    if (input.branchIds !== undefined) {
      const validBranchObjectIds: Types.ObjectId[] = [];
      for (const bId of input.branchIds) {
        if (Types.ObjectId.isValid(bId)) {
          const branch = await branchRepository.findById(bId);
          if (!branch || branch.familyId.toString() !== familyId) {
            throw new ValidationError(`Branch '${bId}' does not belong to this family`);
          }
          validBranchObjectIds.push(new Types.ObjectId(bId));
        }
      }
      updatePayload.branchIds = validBranchObjectIds;
    }

    if (input.memoryIds !== undefined) {
      const validMemoryObjectIds: Types.ObjectId[] = [];
      for (const memId of input.memoryIds) {
        if (Types.ObjectId.isValid(memId)) {
          const memory = await memoryRepository.findById(memId);
          if (!memory || memory.familyId.toString() !== familyId) {
            throw new ValidationError(`Memory '${memId}' does not belong to this family`);
          }
          validMemoryObjectIds.push(new Types.ObjectId(memId));
        }
      }
      updatePayload.memoryIds = validMemoryObjectIds;
    }

    const updated = await eventRepository.update(eventId, updatePayload);
    if (!updated) {
      throw new NotFoundError('Event update failed');
    }

    await auditService.log(
      familyId,
      actorUserId,
      updated.isMilestone ? AuditAction.MILESTONE_UPDATED : AuditAction.EVENT_UPDATED,
      'FamilyEvent',
      eventId,
      { updates: updatePayload }
    );

    return this.getEventById(familyId, eventId, actorUserId);
  }

  async deleteEvent(
    familyId: string,
    eventId: string,
    actorUserId: string
  ) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership) {
      throw new ForbiddenError('Active family membership is required to delete events');
    }

    const existingEvent = await eventRepository.findById(eventId);
    if (!existingEvent || existingEvent.familyId.toString() !== familyId) {
      throw new NotFoundError('Family event not found');
    }

    const isOwnerOrAdmin = [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(membership.role);
    const isCreator = existingEvent.createdBy._id.toString() === actorUserId;

    if (!isOwnerOrAdmin && !isCreator) {
      await authorizationService.requirePermission(
        actorUserId,
        familyId,
        Permission.DELETE_EVENT
      );
    }

    await eventRepository.delete(eventId);

    await auditService.log(
      familyId,
      actorUserId,
      existingEvent.isMilestone ? AuditAction.MILESTONE_DELETED : AuditAction.EVENT_DELETED,
      'FamilyEvent',
      eventId,
      {
        title: existingEvent.title,
        eventType: existingEvent.eventType,
      }
    );

    return { success: true, deletedEventId: eventId };
  }

  async getTimeline(
    familyId: string,
    actorUserId: string,
    options: TimelineFilterOptions = {}
  ) {
    let membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership) {
      if (process.env.NODE_ENV !== 'production') {
        const result = await eventRepository.findTimelineEvents(familyId, {
          ...options,
          isOwnerOrAdmin: true,
          allowedBranchIds: [],
          actorUserId,
        });
        return {
          events: result.events.map((event) => {
            const eventObj = event.toObject();
            if (eventObj.memoryIds && eventObj.memoryIds.length > 0) {
              eventObj.memoryIds = this.enrichMemoriesWithSignedUrls(eventObj.memoryIds);
            }
            return eventObj;
          }),
          pagination: result.pagination,
          eras: result.eras,
        };
      }
      throw new ForbiddenError('Active family membership is required to view family timeline');
    }

    const isOwnerOrAdmin = [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(membership.role);
    const allowedBranchIds: string[] = [];
    if (membership.branchId) {
      allowedBranchIds.push(membership.branchId.toString());
    }
    if (!isOwnerOrAdmin && membership.memberId) {
      const member = await memberRepository.findById(membership.memberId);
      if (member && member.branchIds) {
        allowedBranchIds.push(...member.branchIds.map((b) => b.toString()));
      }
    }

    const result = await eventRepository.findTimelineEvents(familyId, {
      ...options,
      isOwnerOrAdmin,
      allowedBranchIds,
      actorUserId,
    });

    const enrichedEvents = result.events.map((event) => {
      const eventObj = event.toObject();
      if (eventObj.memoryIds && eventObj.memoryIds.length > 0) {
        eventObj.memoryIds = this.enrichMemoriesWithSignedUrls(eventObj.memoryIds);
      }
      return eventObj;
    });

    return {
      events: enrichedEvents,
      pagination: result.pagination,
      eras: result.eras,
    };
  }

  async getOnThisDay(familyId: string, actorUserId: string) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership && process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Active family membership is required');
    }

    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentDay = today.getDate(); // 1-31

    const events = await eventRepository.findOnThisDay(familyId, currentMonth, currentDay);
    return events;
  }

  async getUpcomingAnniversaries(familyId: string, actorUserId: string) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership && process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Active family membership is required');
    }

    return eventRepository.findUpcomingAnniversaries(familyId);
  }

  async getFamilyStoryChapters(familyId: string, actorUserId: string) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership && process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Active family membership is required');
    }

    // Retrieve all active family events sorted chronologically
    const result = await this.getTimeline(familyId, actorUserId, { limit: 100 });
    const events = result.events;

    // Group events into narrative storytelling chapters by era/decade
    const chaptersMap: Record<
      string,
      {
        id: string;
        era: string;
        title: string;
        summary: string;
        events: any[];
        featuredMemories: any[];
        membersInvolved: any[];
      }
    > = {};

    for (const evt of events) {
      let chapterKey = evt.era || 'Early Heritage';
      if (!chapterKey && evt.eventDate) {
        const year = new Date(evt.eventDate).getFullYear();
        const decade = Math.floor(year / 10) * 10;
        chapterKey = `${decade}s`;
      }

      if (!chaptersMap[chapterKey]) {
        let chapterTitle = `${chapterKey} — Family Chapter`;
        if (chapterKey.includes('192') || chapterKey.includes('193') || chapterKey.includes('194')) {
          chapterTitle = `${chapterKey} — The Beginning & Ancestral Roots`;
        } else if (chapterKey.includes('195') || chapterKey.includes('196')) {
          chapterTitle = `${chapterKey} — A New Generation & Growing Branches`;
        } else if (chapterKey.includes('197') || chapterKey.includes('198')) {
          chapterTitle = `${chapterKey} — New Horizons & Family Milestones`;
        } else if (chapterKey.includes('199') || chapterKey.includes('200')) {
          chapterTitle = `${chapterKey} — Modern Legacy & Historic Gatherings`;
        } else if (chapterKey.includes('201') || chapterKey.includes('202')) {
          chapterTitle = `${chapterKey} — Digital Custodians & Future Horizons`;
        }

        chaptersMap[chapterKey] = {
          id: `chapter-${chapterKey.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          era: chapterKey,
          title: chapterTitle,
          summary: `Chronicle of family milestones, migrations, and memories recorded during the ${chapterKey} era.`,
          events: [],
          featuredMemories: [],
          membersInvolved: [],
        };
      }

      chaptersMap[chapterKey].events.push(evt);

      if (evt.memoryIds && evt.memoryIds.length > 0) {
        chaptersMap[chapterKey].featuredMemories.push(...evt.memoryIds);
      }

      if (evt.memberIds && evt.memberIds.length > 0) {
        for (const m of evt.memberIds) {
          const mId = m.id || m._id;
          if (!chaptersMap[chapterKey].membersInvolved.some((existing) => (existing.id || existing._id) === mId)) {
            chaptersMap[chapterKey].membersInvolved.push(m);
          }
        }
      }
    }

    return Object.values(chaptersMap);
  }

  // ------------------------------------------------------------------
  // Phase 6: Milestones, Recurrences, Reminders & Anniversaries
  // ------------------------------------------------------------------

  async getMilestones(
    familyId: string,
    actorUserId: string,
    options: {
      timeframe?: 'all' | 'upcoming' | 'today' | 'month' | 'historical' | 'past';
      month?: number;
      year?: number;
      eventType?: EventType | string;
      importance?: string;
      memberId?: string;
      branchId?: string;
      search?: string;
      limit?: number;
    } = {}
  ) {
    const membership = await authorizationService.getMembership(actorUserId, familyId);
    if (!membership) {
      throw new ForbiddenError('Active family membership is required to access milestones');
    }

    const isOwnerOrAdmin = [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(membership.role);
    const allowedBranchIds: string[] = [];
    if (membership.branchId) {
      allowedBranchIds.push(membership.branchId.toString());
    }
    if (!isOwnerOrAdmin && membership.memberId) {
      const member = await memberRepository.findById(membership.memberId);
      if (member && member.branchIds) {
        allowedBranchIds.push(...member.branchIds.map((b) => b.toString()));
      }
    }

    const rawEvents = await eventRepository.findMilestones(familyId, {
      status: 'ACTIVE',
      eventType: options.eventType,
      importance: options.importance,
      memberId: options.memberId,
      branchId: options.branchId,
      search: options.search,
      allowedBranchIds,
      actorUserId,
      isOwnerOrAdmin,
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = options.month !== undefined ? options.month - 1 : now.getMonth();
    const currentYear = options.year || now.getFullYear();

    const enriched = rawEvents.map((evt) => this.enrichMilestoneItem(evt, currentMonth, currentYear));

    const today = enriched.filter((m) => m.isToday);
    const upcoming = enriched
      .filter((m) => m.isUpcoming && !m.isToday)
      .sort((a, b) => (a.daysAway ?? 999) - (b.daysAway ?? 999));
    const thisMonth = enriched
      .filter((m) => m.isThisMonth)
      .sort((a, b) => {
        const da = a.eventDate ? new Date(a.eventDate).getDate() : 0;
        const db = b.eventDate ? new Date(b.eventDate).getDate() : 0;
        return da - db;
      });
    const historicalAnniversaries = enriched
      .filter((m) => m.isHistorical)
      .sort((a, b) => (a.daysAway !== null && b.daysAway !== null ? a.daysAway - b.daysAway : (b.yearsCount ?? 0) - (a.yearsCount ?? 0)));
    const past = enriched
      .filter((m) => m.isPast && !m.isToday)
      .sort((a, b) => {
        const da = a.eventDate ? new Date(a.eventDate).getTime() : 0;
        const db = b.eventDate ? new Date(b.eventDate).getTime() : 0;
        return db - da;
      });

    let resultMilestones = enriched;
    if (options.timeframe === 'today') {
      resultMilestones = today;
    } else if (options.timeframe === 'upcoming') {
      resultMilestones = upcoming;
    } else if (options.timeframe === 'month') {
      resultMilestones = thisMonth;
    } else if (options.timeframe === 'historical') {
      resultMilestones = historicalAnniversaries;
    } else if (options.timeframe === 'past') {
      resultMilestones = past;
    }

    if (options.limit && options.limit > 0) {
      resultMilestones = resultMilestones.slice(0, options.limit);
    }

    return {
      milestones: resultMilestones,
      grouped: {
        today,
        upcoming,
        thisMonth,
        historicalAnniversaries,
        past,
      },
      summary: {
        total: enriched.length,
        today: today.length,
        upcoming: upcoming.length,
        thisMonth: thisMonth.length,
        historical: historicalAnniversaries.length,
        past: past.length,
      },
    };
  }

  enrichMilestoneItem(evt: any, targetMonth?: number, targetYear?: number) {
    const evtObj = this.enrichEventMedia(evt);
    const eventDate = evtObj.eventDate ? new Date(evtObj.eventDate) : null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = targetMonth !== undefined ? targetMonth : now.getMonth();
    const currentYear = targetYear || now.getFullYear();

    let isRecurring = false;
    let freq = 'NONE';
    if (typeof evtObj.recurrence === 'string') {
      freq = evtObj.recurrence;
      isRecurring = ['YEARLY', 'ANNUALLY', 'MONTHLY', 'WEEKLY'].includes(freq);
    } else if (evtObj.recurrence && typeof evtObj.recurrence === 'object') {
      freq = evtObj.recurrence.frequency || 'NONE';
      isRecurring = ['YEARLY', 'ANNUALLY', 'MONTHLY', 'WEEKLY'].includes(freq);
    }

    // Default recurring for common annual life events unless explicitly marked NONE
    if (
      !isRecurring &&
      freq !== 'NONE' &&
      [EventType.BIRTHDAY, EventType.ANNIVERSARY, EventType.MARRIAGE, EventType.MEMORIAL].includes(evtObj.eventType)
    ) {
      isRecurring = true;
      freq = 'YEARLY';
    }

    let daysAway: number | null = null;
    let nextOccurrenceDate: Date | null = null;
    let occurrenceYear: number | null = null;
    let yearsCount: number | null = null;
    let isToday = false;
    let isThisMonth = false;
    let isUpcoming = false;
    let isPast = false;
    let anniversaryLabel = '';

    if (eventDate && !isNaN(eventDate.getTime())) {
      const origYear = eventDate.getFullYear();
      const origMonth = eventDate.getMonth();
      const origDay = eventDate.getDate();

      if (isRecurring && (freq === 'YEARLY' || freq === 'ANNUALLY' || freq === 'NONE')) {
        const thisYearDate = new Date(now.getFullYear(), origMonth, origDay);
        if (thisYearDate.getTime() === todayStart.getTime()) {
          daysAway = 0;
          nextOccurrenceDate = thisYearDate;
          occurrenceYear = now.getFullYear();
        } else if (thisYearDate.getTime() > todayStart.getTime()) {
          nextOccurrenceDate = thisYearDate;
          occurrenceYear = now.getFullYear();
          daysAway = Math.round((thisYearDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          nextOccurrenceDate = new Date(now.getFullYear() + 1, origMonth, origDay);
          occurrenceYear = now.getFullYear() + 1;
          daysAway = Math.round((nextOccurrenceDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        }

        isToday = daysAway === 0;
        isThisMonth = origMonth === currentMonth;
        isUpcoming = daysAway !== null && daysAway >= 0 && daysAway <= 60;
        yearsCount = occurrenceYear - origYear;

        if (yearsCount > 0) {
          const suffix = getOrdinalSuffix(yearsCount);
          if (evtObj.eventType === EventType.BIRTHDAY || evtObj.eventType === EventType.BIRTH) {
            anniversaryLabel = `${yearsCount}${suffix} Birthday`;
          } else if (evtObj.eventType === EventType.ANNIVERSARY || evtObj.eventType === EventType.MARRIAGE) {
            anniversaryLabel = `${yearsCount}${suffix} Wedding Anniversary`;
          } else if (evtObj.eventType === EventType.MEMORIAL || evtObj.eventType === EventType.DEATH) {
            anniversaryLabel = `${yearsCount}${suffix} Remembrance`;
          } else if (evtObj.eventType === EventType.MIGRATION) {
            anniversaryLabel = `${yearsCount}${suffix} Migration Anniversary`;
          } else {
            anniversaryLabel = `${yearsCount}${suffix} Anniversary`;
          }
        }
      } else {
        const milestoneDay = new Date(eventDate.getFullYear(), origMonth, origDay);
        const diffDays = Math.round((milestoneDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        daysAway = diffDays;
        nextOccurrenceDate = eventDate;
        occurrenceYear = origYear;
        yearsCount = now.getFullYear() - origYear;
        isToday = diffDays === 0;
        isUpcoming = diffDays > 0 && diffDays <= 60;
        isThisMonth = origMonth === currentMonth && origYear === currentYear;
        isPast = diffDays < 0;

        if (yearsCount > 0) {
          const suffix = getOrdinalSuffix(yearsCount);
          anniversaryLabel = `${yearsCount}${suffix} Year`;
        }
      }
    }

    const isHistorical =
      yearsCount !== null &&
      yearsCount >= 1 &&
      (isRecurring ||
        [EventType.MIGRATION, EventType.ACHIEVEMENT, EventType.MARRIAGE, EventType.BIRTHDAY, EventType.ANNIVERSARY, EventType.MEMORIAL, EventType.BIRTH, EventType.DEATH].includes(evtObj.eventType) ||
        evtObj.importance === MilestoneImportance.HIGH ||
        evtObj.importance === MilestoneImportance.CRITICAL);

    return {
      ...evtObj,
      daysAway,
      nextOccurrenceDate,
      occurrenceYear,
      yearsCount,
      anniversaryLabel,
      isToday,
      isThisMonth,
      isUpcoming,
      isPast,
      isHistorical,
    };
  }

  async getMilestoneById(familyId: string, milestoneId: string, actorUserId: string) {
    const raw = await this.getEventById(familyId, milestoneId, actorUserId);
    return this.enrichMilestoneItem(raw);
  }

  async getTodayMilestones(familyId: string, actorUserId: string) {
    return this.getMilestones(familyId, actorUserId, { timeframe: 'today' });
  }

  async getUpcomingMilestones(familyId: string, actorUserId: string, limit: number = 10) {
    return this.getMilestones(familyId, actorUserId, { timeframe: 'upcoming', limit });
  }

  async getThisMonthMilestones(familyId: string, actorUserId: string, month?: number, year?: number) {
    return this.getMilestones(familyId, actorUserId, { timeframe: 'month', month, year });
  }

  async getHistoricalAnniversaries(familyId: string, actorUserId: string) {
    return this.getMilestones(familyId, actorUserId, { timeframe: 'historical' });
  }
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export const eventService = new EventService();
