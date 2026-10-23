import { Types } from 'mongoose';
import { FamilyMember, IFamilyMember } from '../models/FamilyMember.ts';
import { Memory, IMemory } from '../models/Memory.ts';
import { FamilyEvent, IFamilyEvent } from '../models/FamilyEvent.ts';
import { Branch, IBranch } from '../models/Branch.ts';
import { Relationship, IRelationship } from '../models/Relationship.ts';
import { MemoryVisibility, MemoryStatus, EventVisibility, Role, normalizeRole } from '../constants/index.ts';
import { ServiceContext } from './familyService.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { auditRepository } from '../repositories/auditRepository.ts';

export interface GlobalSearchFilters {
  q?: string;
  category?: 'ALL' | 'PEOPLE' | 'MEMORIES' | 'EVENTS' | 'BRANCHES' | 'RELATIONSHIPS';
  generation?: number;
  branchId?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  ageMin?: number;
  ageMax?: number;
  birthYearMin?: number;
  birthYearMax?: number;
  birthYear?: number;
  location?: string;
  occupation?: string;
  relationshipType?: string;
  memoryType?: string;
  eventType?: string;
  era?: string;
  tag?: string;
  isLiving?: boolean;
  page?: number;
  limit?: number;
}

export interface MemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  gender: string;
  generation: number;
  profilePhoto?: string;
  birthPlace?: string;
  deathPlace?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  isLiving: boolean;
  occupation?: string;
  biography?: string;
  branchIds: string[];
  branchNames: string[];
  relationshipCount: number;
  memoryCount: number;
  score?: number;
  matchedFields?: string[];
}

export interface MemorySearchResult {
  id: string;
  title: string;
  description: string;
  memoryType: string;
  eventDate?: Date;
  eventDateApprox?: string;
  location?: string;
  tags: string[];
  coverMediaUrl?: string;
  memberIds: string[];
  branchIds: string[];
  visibility: string;
  matchedFields?: string[];
}

export interface EventSearchResult {
  id: string;
  title: string;
  description: string;
  eventType: string;
  eventDate: Date;
  location?: string;
  era?: string;
  isMilestone: boolean;
  memberIds: string[];
  branchIds: string[];
  matchedFields?: string[];
}

export interface BranchSearchResult {
  id: string;
  name: string;
  description?: string;
  accentColor?: string;
  rootMemberId?: string;
  rootMemberName?: string;
  memberCount: number;
  matchedFields?: string[];
}

export interface GlobalSearchResponse {
  query: string;
  category: string;
  totalResults: number;
  counts: {
    all: number;
    people: number;
    memories: number;
    events: number;
    branches: number;
  };
  results: {
    people: MemberSearchResult[];
    memories: MemorySearchResult[];
    events: EventSearchResult[];
    branches: BranchSearchResult[];
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SearchSuggestion {
  text: string;
  category: 'PERSON' | 'LOCATION' | 'OCCUPATION' | 'TAG' | 'BRANCH' | 'ERA' | 'SMART_PROMPT';
  count?: number;
  meta?: Record<string, any>;
}

export class SearchService {
  /**
   * Main unified search across all domains in FamilyRoots with RBAC and family boundaries
   */
  async globalSearch(
    familyId: string,
    filters: GlobalSearchFilters,
    context?: ServiceContext
  ): Promise<GlobalSearchResponse> {
    if (!Types.ObjectId.isValid(familyId)) {
      throw new Error(`Invalid family ID: ${familyId}`);
    }

    const fid = new Types.ObjectId(familyId);
    const q = (filters.q || '').trim();
    const category = filters.category || 'ALL';
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    // 1. Determine user permissions & scope
    let isOwnerOrAdmin = false;
    let allowedBranchIds: string[] = [];
    let actorUserId = context?.userId;

    if (actorUserId && Types.ObjectId.isValid(actorUserId)) {
      const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
      if (membership) {
        if (normalizeRole(membership.role) === Role.ADMIN) {
          isOwnerOrAdmin = true;
        }
        if (membership.branchId) {
          allowedBranchIds = [membership.branchId.toString()];
        }
      }
    }

    // 2. Build Member Search Query
    const memberQuery: any = { familyId: fid, isArchived: { $ne: true } };

    if (q) {
      const regex = new RegExp(q, 'i');
      memberQuery.$or = [
        { firstName: regex },
        { lastName: regex },
        { displayName: regex },
        { nickname: regex },
        { occupation: regex },
        { birthPlace: regex },
        { deathPlace: regex },
        { education: regex },
        { biography: regex },
      ];
    }

    if (filters.generation !== undefined && !isNaN(Number(filters.generation))) {
      memberQuery.generation = Number(filters.generation);
    }

    if (filters.branchId && Types.ObjectId.isValid(filters.branchId)) {
      memberQuery.branchIds = new Types.ObjectId(filters.branchId);
    }

    if (filters.gender) {
      memberQuery.gender = filters.gender;
    }

    if (filters.isLiving !== undefined) {
      memberQuery.isLiving = Boolean(filters.isLiving);
    }

    if (filters.occupation) {
      memberQuery.occupation = new RegExp(filters.occupation.trim(), 'i');
    }

    if (filters.location) {
      const locRegex = new RegExp(filters.location.trim(), 'i');
      memberQuery.$and = memberQuery.$and || [];
      memberQuery.$and.push({
        $or: [{ birthPlace: locRegex }, { deathPlace: locRegex }],
      });
    }

    if (filters.birthYear || filters.birthYearMin || filters.birthYearMax) {
      const minYear = filters.birthYear || filters.birthYearMin || 1800;
      const maxYear = filters.birthYear || filters.birthYearMax || 2100;
      // dateOfBirth is stored as YYYY-MM-DD or date string
      const yearRegex = new RegExp(`^(${Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).join('|')})`);
      memberQuery.dateOfBirth = { $regex: yearRegex };
    }

    // 3. Build Memory Search Query
    const memoryQuery: any = { familyId: fid, status: MemoryStatus.ACTIVE };

    if (q) {
      const regex = new RegExp(q, 'i');
      memoryQuery.$or = [
        { title: regex },
        { description: regex },
        { location: regex },
        { tags: regex },
      ];
    }

    if (filters.memoryType) {
      memoryQuery.memoryType = filters.memoryType;
    }

    if (filters.tag) {
      memoryQuery.tags = filters.tag.toLowerCase();
    }

    if (filters.branchId && Types.ObjectId.isValid(filters.branchId)) {
      memoryQuery.branchIds = new Types.ObjectId(filters.branchId);
    }

    if (filters.location) {
      memoryQuery.location = new RegExp(filters.location.trim(), 'i');
    }

    if (filters.birthYear || filters.birthYearMin || filters.birthYearMax) {
      const minYear = filters.birthYear || filters.birthYearMin || 1800;
      const maxYear = filters.birthYear || filters.birthYearMax || 2100;
      const start = new Date(Date.UTC(minYear, 0, 1));
      const end = new Date(Date.UTC(maxYear, 11, 31, 23, 59, 59));
      memoryQuery.eventDate = { $gte: start, $lte: end };
    }

    // Memory visibility security filter
    if (!isOwnerOrAdmin) {
      const visConditions: any[] = [
        { visibility: MemoryVisibility.PUBLIC },
        { visibility: MemoryVisibility.FAMILY },
      ];
      if (actorUserId && Types.ObjectId.isValid(actorUserId)) {
        visConditions.push({
          visibility: MemoryVisibility.PRIVATE,
          createdBy: new Types.ObjectId(actorUserId),
        });
      }
      if (allowedBranchIds.length > 0) {
        visConditions.push({
          visibility: MemoryVisibility.BRANCH,
          branchIds: { $in: allowedBranchIds.map((b) => new Types.ObjectId(b)) },
        });
      }
      memoryQuery.$and = memoryQuery.$and || [];
      memoryQuery.$and.push({ $or: visConditions });
    }

    // 4. Build Timeline Event Search Query
    const eventQuery: any = { familyId: fid, status: 'ACTIVE' };

    if (q) {
      const regex = new RegExp(q, 'i');
      eventQuery.$or = [
        { title: regex },
        { description: regex },
        { location: regex },
        { era: regex },
      ];
    }

    if (filters.eventType) {
      eventQuery.eventType = filters.eventType;
    }

    if (filters.era) {
      eventQuery.era = new RegExp(filters.era.trim(), 'i');
    }

    if (filters.branchId && Types.ObjectId.isValid(filters.branchId)) {
      eventQuery.branchIds = new Types.ObjectId(filters.branchId);
    }

    if (filters.location) {
      eventQuery.location = new RegExp(filters.location.trim(), 'i');
    }

    // Event visibility filter
    if (!isOwnerOrAdmin) {
      const eventVisConditions: any[] = [
        { visibility: EventVisibility.FAMILY },
      ];
      if (actorUserId && Types.ObjectId.isValid(actorUserId)) {
        eventVisConditions.push({
          visibility: EventVisibility.PRIVATE,
          createdBy: new Types.ObjectId(actorUserId),
        });
      }
      if (allowedBranchIds.length > 0) {
        eventVisConditions.push({
          visibility: EventVisibility.BRANCH,
          branchIds: { $in: allowedBranchIds.map((b) => new Types.ObjectId(b)) },
        });
      }
      eventQuery.$and = eventQuery.$and || [];
      eventQuery.$and.push({ $or: eventVisConditions });
    }

    // 5. Build Branch Search Query
    const branchQuery: any = { familyId: fid };
    if (q) {
      const regex = new RegExp(q, 'i');
      branchQuery.$or = [{ name: regex }, { description: regex }];
    }

    // Fetch branches for name mapping
    const allBranches = await Branch.find({ familyId: fid }).lean();
    const branchMap = new Map<string, string>();
    allBranches.forEach((b: any) => branchMap.set(b._id.toString(), b.name));

    // Execute queries in parallel
    const shouldFetchPeople = category === 'ALL' || category === 'PEOPLE';
    const shouldFetchMemories = category === 'ALL' || category === 'MEMORIES';
    const shouldFetchEvents = category === 'ALL' || category === 'EVENTS';
    const shouldFetchBranches = category === 'ALL' || category === 'BRANCHES';

    const [
      peopleCount,
      memoriesCount,
      eventsCount,
      branchesCount,
      peopleDocs,
      memoryDocs,
      eventDocs,
      branchDocs,
      allRelationships,
    ] = await Promise.all([
      FamilyMember.countDocuments(memberQuery).exec(),
      Memory.countDocuments(memoryQuery).exec(),
      FamilyEvent.countDocuments(eventQuery).exec(),
      Branch.countDocuments(branchQuery).exec(),
      shouldFetchPeople
        ? FamilyMember.find(memberQuery)
            .sort({ generation: 1, lastName: 1 })
            .skip(category === 'PEOPLE' ? skip : 0)
            .limit(category === 'PEOPLE' ? limit : 6)
            .lean()
            .exec()
        : Promise.resolve([]),
      shouldFetchMemories
        ? Memory.find(memoryQuery)
            .populate('coverMediaId', 'thumbnailStorageKey storageKey mimeType fileSize')
            .sort({ eventDate: -1, createdAt: -1 })
            .skip(category === 'MEMORIES' ? skip : 0)
            .limit(category === 'MEMORIES' ? limit : 6)
            .lean()
            .exec()
        : Promise.resolve([]),
      shouldFetchEvents
        ? FamilyEvent.find(eventQuery)
            .sort({ eventDate: 1 })
            .skip(category === 'EVENTS' ? skip : 0)
            .limit(category === 'EVENTS' ? limit : 6)
            .lean()
            .exec()
        : Promise.resolve([]),
      shouldFetchBranches
        ? Branch.find(branchQuery)
            .skip(category === 'BRANCHES' ? skip : 0)
            .limit(category === 'BRANCHES' ? limit : 6)
            .lean()
            .exec()
        : Promise.resolve([]),
      Relationship.find({ familyId: fid }).lean().exec(),
    ]);

    // Compute relationship count map
    const relCountMap = new Map<string, number>();
    allRelationships.forEach((r: any) => {
      const s = r.sourceMemberId.toString();
      const t = r.targetMemberId.toString();
      relCountMap.set(s, (relCountMap.get(s) || 0) + 1);
      relCountMap.set(t, (relCountMap.get(t) || 0) + 1);
    });

    // Format people
    const peopleResults: MemberSearchResult[] = peopleDocs.map((m: any) => {
      const bNames = (m.branchIds || []).map((bId: any) => branchMap.get(bId.toString()) || 'Branch');
      const matched: string[] = [];
      if (q) {
        const lowerQ = q.toLowerCase();
        if (m.firstName?.toLowerCase().includes(lowerQ)) matched.push('First Name');
        if (m.lastName?.toLowerCase().includes(lowerQ)) matched.push('Last Name');
        if (m.occupation?.toLowerCase().includes(lowerQ)) matched.push('Occupation');
        if (m.birthPlace?.toLowerCase().includes(lowerQ)) matched.push('Birthplace');
        if (m.biography?.toLowerCase().includes(lowerQ)) matched.push('Biography');
      }

      return {
        id: m._id.toString(),
        firstName: m.firstName,
        lastName: m.lastName,
        displayName: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        gender: m.gender,
        generation: m.generation || 1,
        profilePhoto: m.profilePhoto,
        birthPlace: m.birthPlace,
        deathPlace: m.deathPlace,
        dateOfBirth: m.dateOfBirth,
        dateOfDeath: m.dateOfDeath,
        isLiving: m.isLiving,
        occupation: m.occupation,
        biography: m.biography,
        branchIds: (m.branchIds || []).map((b: any) => b.toString()),
        branchNames: bNames,
        relationshipCount: relCountMap.get(m._id.toString()) || 0,
        memoryCount: m.memoryCount || 0,
        matchedFields: matched,
      };
    });

    // Format memories
    const memoryResults: MemorySearchResult[] = memoryDocs.map((m: any) => {
      const matched: string[] = [];
      if (q) {
        const lowerQ = q.toLowerCase();
        if (m.title?.toLowerCase().includes(lowerQ)) matched.push('Title');
        if (m.description?.toLowerCase().includes(lowerQ)) matched.push('Description');
        if (m.location?.toLowerCase().includes(lowerQ)) matched.push('Location');
        if ((m.tags || []).some((t: string) => t.toLowerCase().includes(lowerQ))) matched.push('Tags');
      }

      let coverMediaUrl: string | undefined = undefined;
      if (m.coverMediaId) {
        coverMediaUrl = `/api/media/${m.coverMediaId._id || m.coverMediaId}/stream`;
      }

      return {
        id: m._id.toString(),
        title: m.title,
        description: m.description,
        memoryType: m.memoryType,
        eventDate: m.eventDate,
        eventDateApprox: m.eventDateApprox,
        location: m.location,
        tags: m.tags || [],
        coverMediaUrl,
        memberIds: (m.memberIds || []).map((id: any) => id.toString()),
        branchIds: (m.branchIds || []).map((id: any) => id.toString()),
        visibility: m.visibility,
        matchedFields: matched,
      };
    });

    // Format events
    const eventResults: EventSearchResult[] = eventDocs.map((e: any) => {
      const matched: string[] = [];
      if (q) {
        const lowerQ = q.toLowerCase();
        if (e.title?.toLowerCase().includes(lowerQ)) matched.push('Title');
        if (e.description?.toLowerCase().includes(lowerQ)) matched.push('Description');
        if (e.location?.toLowerCase().includes(lowerQ)) matched.push('Location');
        if (e.era?.toLowerCase().includes(lowerQ)) matched.push('Era');
      }

      return {
        id: e._id.toString(),
        title: e.title,
        description: e.description,
        eventType: e.eventType,
        eventDate: e.eventDate,
        location: e.location,
        era: e.era,
        isMilestone: !!e.isMilestone,
        memberIds: (e.memberIds || []).map((id: any) => id.toString()),
        branchIds: (e.branchIds || []).map((id: any) => id.toString()),
        matchedFields: matched,
      };
    });

    // Format branches
    const branchResults: BranchSearchResult[] = branchDocs.map((b: any) => {
      const matched: string[] = [];
      if (q) {
        const lowerQ = q.toLowerCase();
        if (b.name?.toLowerCase().includes(lowerQ)) matched.push('Name');
        if (b.description?.toLowerCase().includes(lowerQ)) matched.push('Description');
      }

      return {
        id: b._id.toString(),
        name: b.name,
        description: b.description,
        accentColor: b.accentColor,
        rootMemberId: b.rootMemberId ? b.rootMemberId.toString() : undefined,
        rootMemberName: b.rootMemberName,
        memberCount: b.memberCount || 0,
        matchedFields: matched,
      };
    });

    const totalResults = peopleCount + memoriesCount + eventsCount + branchesCount;
    const categoryTotal =
      category === 'PEOPLE'
        ? peopleCount
        : category === 'MEMORIES'
        ? memoriesCount
        : category === 'EVENTS'
        ? eventsCount
        : category === 'BRANCHES'
        ? branchesCount
        : totalResults;

    const totalPages = Math.max(1, Math.ceil(categoryTotal / limit));

    return {
      query: q,
      category,
      totalResults,
      counts: {
        all: totalResults,
        people: peopleCount,
        memories: memoriesCount,
        events: eventsCount,
        branches: branchesCount,
      },
      results: {
        people: peopleResults,
        memories: memoryResults,
        events: eventResults,
        branches: branchResults,
      },
      pagination: {
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Fast suggestions endpoint for instant search dropdown with smart contextual suggestions
   */
  async getSearchSuggestions(familyId: string, query?: string): Promise<SearchSuggestion[]> {
    if (!Types.ObjectId.isValid(familyId)) {
      return [];
    }

    const fid = new Types.ObjectId(familyId);
    const suggestions: SearchSuggestion[] = [];

    // If query is empty or very short, return contextual smart prompt suggestions derived strictly from indexed data
    if (!query || query.trim().length === 0) {
      const [branches, members, memories] = await Promise.all([
        Branch.find({ familyId: fid }).limit(3).lean(),
        FamilyMember.find({ familyId: fid, isArchived: { $ne: true } }).limit(4).lean(),
        Memory.find({ familyId: fid, status: MemoryStatus.ACTIVE }).limit(10).lean(),
      ]);

      // 1. Contextual prompt: "People from [Branch Name]"
      branches.forEach((b: any) => {
        suggestions.push({
          text: `People from ${b.name}`,
          category: 'SMART_PROMPT',
          meta: { filterType: 'BRANCH', branchId: b._id.toString() },
        });
      });

      // 2. Contextual prompt: "Memories from the [Decade]"
      const decades = new Set<string>();
      memories.forEach((m: any) => {
        if (m.eventDate) {
          const y = new Date(m.eventDate).getFullYear();
          if (y) decades.add(`${Math.floor(y / 10) * 10}s`);
        }
      });
      Array.from(decades).slice(0, 2).forEach((dec) => {
        suggestions.push({
          text: `Memories from the ${dec}`,
          category: 'SMART_PROMPT',
          meta: { filterType: 'DECADE', decade: dec },
        });
      });

      // 3. Contextual prompt: "Relatives connected to [Person]"
      members.slice(0, 2).forEach((m: any) => {
        const name = m.displayName || `${m.firstName} ${m.lastName}`.trim();
        suggestions.push({
          text: `Relatives connected to ${name}`,
          category: 'SMART_PROMPT',
          meta: { filterType: 'PERSON', memberId: m._id.toString() },
        });
      });

      // 4. Contextual prompt: "Photos containing [Person]'s memories"
      if (members[0]) {
        const name = members[0].displayName || `${members[0].firstName} ${members[0].lastName}`.trim();
        suggestions.push({
          text: `Photos containing ${name}'s memories`,
          category: 'SMART_PROMPT',
          meta: { filterType: 'PHOTOS', memberId: members[0]._id.toString() },
        });
      }

      return suggestions;
    }

    const regex = new RegExp(query.trim(), 'i');

    // 1. Members matching name
    const members = await FamilyMember.find({
      familyId: fid,
      isArchived: { $ne: true },
      $or: [{ firstName: regex }, { lastName: regex }, { displayName: regex }],
    })
      .limit(4)
      .lean();

    members.forEach((m: any) => {
      suggestions.push({
        text: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        category: 'PERSON',
        meta: { id: m._id.toString(), generation: m.generation, occupation: m.occupation },
      });
    });

    // 2. Locations matching
    const distinctLocations = await FamilyMember.distinct('birthPlace', {
      familyId: fid,
      birthPlace: regex,
    });
    distinctLocations.slice(0, 3).forEach((loc) => {
      if (loc && loc.trim()) {
        suggestions.push({ text: loc.trim(), category: 'LOCATION' });
      }
    });

    // 3. Occupations matching
    const distinctOccupations = await FamilyMember.distinct('occupation', {
      familyId: fid,
      occupation: regex,
    });
    distinctOccupations.slice(0, 3).forEach((occ) => {
      if (occ && occ.trim()) {
        suggestions.push({ text: occ.trim(), category: 'OCCUPATION' });
      }
    });

    // 4. Tags from memories
    const memoriesWithTags = await Memory.find({
      familyId: fid,
      status: MemoryStatus.ACTIVE,
      tags: regex,
    })
      .select('tags')
      .limit(5)
      .lean();

    const tagSet = new Set<string>();
    memoriesWithTags.forEach((m: any) => {
      (m.tags || []).forEach((t: string) => {
        if (t.toLowerCase().includes(query.toLowerCase())) {
          tagSet.add(t);
        }
      });
    });
    Array.from(tagSet)
      .slice(0, 3)
      .forEach((tag) => {
        suggestions.push({ text: tag, category: 'TAG' });
      });

    // 5. Branches
    const branches = await Branch.find({ familyId: fid, name: regex }).limit(2).lean();
    branches.forEach((b: any) => {
      suggestions.push({
        text: b.name,
        category: 'BRANCH',
        meta: { id: b._id.toString(), accentColor: b.accentColor },
      });
    });

    return suggestions;
  }
}

export const searchService = new SearchService();
