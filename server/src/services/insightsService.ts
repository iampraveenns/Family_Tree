import { Types } from 'mongoose';
import { FamilyMember } from '../models/FamilyMember.ts';
import { Relationship } from '../models/Relationship.ts';
import { Branch } from '../models/Branch.ts';
import { Memory } from '../models/Memory.ts';
import { FamilyEvent } from '../models/FamilyEvent.ts';
import { MemoryCollection } from '../models/MemoryCollection.ts';
import { User } from '../models/User.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { Role, RelationshipStatus, MemoryStatus, MemoryVisibility, EventVisibility, RelationshipType } from '../constants/index.ts';
import { ForbiddenError, NotFoundError } from '../utils/errors.ts';

export interface LargestBranchInsight {
  id: string;
  name: string;
  memberCount: number;
  percentage: number;
  accentColor?: string;
}

export interface OldestAncestorInsight {
  id: string;
  name: string;
  gender: string;
  generation: number;
  dateOfBirth?: string;
  birthYear?: number;
  birthPlace?: string;
  isLiving: boolean;
  profilePhoto?: string;
  occupation?: string;
  ageOrLifespan?: string;
}

export interface DocumentedRelativeInsight {
  id: string;
  name: string;
  generation: number;
  profilePhoto?: string;
  branchNames: string[];
  memoryCount: number;
  eventCount: number;
  hasBiography: boolean;
  totalItems: number;
}

export interface MemoryPeriodInsight {
  decade: string;
  startYear: number;
  endYear: number;
  memoryCount: number;
  isPeak: boolean;
}

export interface ActiveContributorInsight {
  id: string;
  name: string;
  role: string;
  memoriesCount: number;
  eventsCount: number;
  totalContributions: number;
}

export interface ConnectedPlaceInsight {
  place: string;
  count: number;
  sourceTypes: ('BIRTH' | 'DEATH' | 'MEMORY' | 'EVENT')[];
}

export interface FamilyEraInsight {
  eraName: string;
  timeframe: string;
  eventCount: number;
  memoryCount: number;
  summary: string;
}

export interface HeritageGapItem {
  id: string;
  type: 'MISSING_BIRTH_YEAR' | 'RELATIONSHIP_VERIFICATION' | 'MISSING_MEMORIES' | 'LIMITED_GENERATION_DOC';
  title: string;
  description: string;
  count: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  actionLabel: string;
  actionTarget: string;
  members?: Array<{ id: string; name: string; generation: number; profilePhoto?: string }>;
  relationships?: Array<{ id: string; sourceName: string; targetName: string; relationshipType: string }>;
}

export interface GenerationCoverageInsight {
  generation: number;
  generationLabel: string;
  memberCount: number;
  memoryCount: number;
  coveragePercentage: number;
  documentedCount: number;
  undocumentedCount: number;
  documentedMembers: Array<{ id: string; name: string; profilePhoto?: string }>;
  undocumentedMembers: Array<{ id: string; name: string; profilePhoto?: string }>;
}

export interface TimelineInsightPeriod {
  decade: string;
  timeframe: string;
  memoryCount: number;
  eventCount: number;
  status: 'MEMORY_RICH' | 'ACTIVE_EVENTS' | 'SPARSE' | 'BALANCED';
  description: string;
}

export interface FamilyStatistics {
  totalRelatives: number;
  livingCount: number;
  deceasedCount: number;
  generationsCount: number;
  branchesCount: number;
  relationshipsCount: number;
  memoriesCount: number;
  eventsCount: number;
  collectionsCount: number;
  relationshipsByType: Record<string, number>;
  memoriesByType: Record<string, number>;
}

export interface InsightCard {
  id: string;
  headline: string;
  subtext: string;
  category: 'GENERATIONS' | 'BRANCHES' | 'MEMORIES' | 'GAPS';
  icon: string;
}

export interface FamilyInsightsResponse {
  familyId: string;
  familyName: string;
  generationDepth: {
    minGeneration: number;
    maxGeneration: number;
    totalGenerations: number;
    deepestDescendants: Array<{ id: string; name: string; generation: number }>;
  };
  largestBranch: LargestBranchInsight | null;
  oldestAncestor: OldestAncestorInsight | null;
  mostDocumentedRelatives: DocumentedRelativeInsight[];
  memoryRichPeriods: MemoryPeriodInsight[];
  peakMemoryDecade: string | null;
  activeContributors: ActiveContributorInsight[];
  connectedPlaces: ConnectedPlaceInsight[];
  importantEras: FamilyEraInsight[];
  heritageGaps: HeritageGapItem[];
  memoryCoverageByGeneration: GenerationCoverageInsight[];
  timelineInsights: TimelineInsightPeriod[];
  statistics: FamilyStatistics;
  cards: InsightCard[];
  smartSuggestions: string[];
}

export interface BranchInsightDetail {
  id: string;
  name: string;
  accentColor: string;
  description?: string;
  memberCount: number;
  percentageOfFamily: number;
  generations: number[];
  generationRange: string;
  memoryCount: number;
  eventCount: number;
  contributorCount: number;
  growthByGeneration: Record<number, number>;
}

// In-memory short TTL cache (30s) to satisfy performance requirement
interface CachedEntry {
  data: any;
  timestamp: number;
}
const insightCache = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 30_000;

export class InsightsService {
  /**
   * Helper to clear cache when data modifies
   */
  clearCache(familyId?: string) {
    if (familyId) {
      for (const key of insightCache.keys()) {
        if (key.startsWith(familyId)) {
          insightCache.delete(key);
        }
      }
    } else {
      insightCache.clear();
    }
  }

  /**
   * Checks authorization and resolves access scope for current user
   */
  private async getAuthorizedScope(familyId: string, actorUserId: string) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Active membership required to access family insights');
    }

    const isOwnerOrAdmin =
      membership.role === Role.FAMILY_OWNER || membership.role === Role.FAMILY_ADMIN;

    let allowedBranchIds: string[] = [];
    if (!isOwnerOrAdmin && membership.memberId) {
      const member = await FamilyMember.findById(membership.memberId).lean();
      if (member && member.branchIds) {
        allowedBranchIds = member.branchIds.map((b: any) => b.toString());
      }
    }

    return {
      membership,
      isOwnerOrAdmin,
      allowedBranchIds,
      userMemberId: membership.memberId ? membership.memberId.toString() : null,
    };
  }

  /**
   * Primary Insights Aggregation
   */
  async getFamilyInsights(familyId: string, actorUserId: string): Promise<FamilyInsightsResponse> {
    const cacheKey = `${familyId}:${actorUserId}:overview`;
    const cached = insightCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const fid = new Types.ObjectId(familyId);
    const { membership, isOwnerOrAdmin, allowedBranchIds } = await this.getAuthorizedScope(familyId, actorUserId);

    // 1. Fetch Family info
    const familyDoc = await FamilyMember.db.model('Family').findById(fid).lean() as any;
    const familyName = familyDoc?.name || 'Family';

    // 2. Query Members
    const memberDocs = await FamilyMember.find({
      familyId: fid,
      isArchived: { $ne: true },
    }).lean();

    // 3. Query Relationships
    const relationshipDocs = await Relationship.find({
      familyId: fid,
    }).lean();

    // 4. Query Branches
    const branchDocs = await Branch.find({
      familyId: fid,
    }).lean();
    const branchMap = new Map<string, any>();
    branchDocs.forEach((b: any) => branchMap.set(b._id.toString(), b));

    // 5. Query Memories respecting visibility
    const memoryQuery: any = {
      familyId: fid,
      status: MemoryStatus.ACTIVE,
    };
    if (!isOwnerOrAdmin) {
      const userOid = new Types.ObjectId(actorUserId);
      memoryQuery.$or = [
        { visibility: MemoryVisibility.FAMILY },
        { visibility: MemoryVisibility.PUBLIC },
        { createdBy: userOid },
        ...(allowedBranchIds.length > 0
          ? [{ visibility: MemoryVisibility.BRANCH, branchIds: { $in: allowedBranchIds.map((id) => new Types.ObjectId(id)) } }]
          : []),
      ];
    }
    const memoryDocs = await Memory.find(memoryQuery).lean();

    // 6. Query Events respecting visibility
    const eventQuery: any = {
      familyId: fid,
      status: 'ACTIVE',
    };
    if (!isOwnerOrAdmin) {
      const userOid = new Types.ObjectId(actorUserId);
      eventQuery.$or = [
        { visibility: EventVisibility.FAMILY },
        { createdBy: userOid },
        ...(allowedBranchIds.length > 0
          ? [{ visibility: EventVisibility.BRANCH, branchIds: { $in: allowedBranchIds.map((id) => new Types.ObjectId(id)) } }]
          : []),
      ];
    }
    const eventDocs = await FamilyEvent.find(eventQuery).lean();

    // 7. Query Collections
    const collectionDocs = await MemoryCollection.find({
      familyId: fid,
      status: MemoryStatus.ACTIVE,
    }).lean();

    // ==========================================
    // A. GENERATION DEPTH & STATS
    // ==========================================
    let minGen = 1;
    let maxGen = 1;
    let livingCount = 0;
    let deceasedCount = 0;
    const membersByGen = new Map<number, any[]>();

    memberDocs.forEach((m: any) => {
      const gen = typeof m.generation === 'number' && m.generation > 0 ? m.generation : 1;
      if (gen > maxGen) maxGen = gen;
      if (gen < minGen) minGen = gen;

      if (!membersByGen.has(gen)) membersByGen.set(gen, []);
      membersByGen.get(gen)!.push(m);

      if (m.isLiving === false) {
        deceasedCount++;
      } else {
        livingCount++;
      }
    });

    const totalGenerations = memberDocs.length > 0 ? maxGen - minGen + 1 : 0;
    const deepestDescendants = (membersByGen.get(maxGen) || []).slice(0, 4).map((m) => ({
      id: m._id.toString(),
      name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
      generation: m.generation || maxGen,
    }));

    // ==========================================
    // B. LARGEST FAMILY BRANCH
    // ==========================================
    const branchMemberCounts = new Map<string, number>();
    memberDocs.forEach((m: any) => {
      (m.branchIds || []).forEach((bId: any) => {
        const idStr = bId.toString();
        branchMemberCounts.set(idStr, (branchMemberCounts.get(idStr) || 0) + 1);
      });
    });

    let largestBranch: LargestBranchInsight | null = null;
    let maxBranchCount = -1;
    branchDocs.forEach((b: any) => {
      const count = branchMemberCounts.get(b._id.toString()) || 0;
      if (count > maxBranchCount) {
        maxBranchCount = count;
        largestBranch = {
          id: b._id.toString(),
          name: b.name,
          memberCount: count,
          percentage: memberDocs.length > 0 ? Math.round((count / memberDocs.length) * 100) : 0,
          accentColor: b.accentColor || '#0F8F72',
        };
      }
    });

    // ==========================================
    // C. OLDEST RECORDED ANCESTOR
    // ==========================================
    let oldestAncestor: OldestAncestorInsight | null = null;
    let earliestBirthYear = 9999;

    memberDocs.forEach((m: any) => {
      let birthYear: number | null = null;
      if (m.dateOfBirth) {
        const parsed = parseInt(m.dateOfBirth.slice(0, 4), 10);
        if (!isNaN(parsed) && parsed > 1000 && parsed < 2100) {
          birthYear = parsed;
        }
      }

      if (birthYear !== null && birthYear < earliestBirthYear) {
        earliestBirthYear = birthYear;
        const deathYear = m.dateOfDeath ? parseInt(m.dateOfDeath.slice(0, 4), 10) : null;
        let lifespan = '';
        if (birthYear && deathYear) {
          lifespan = `${birthYear} – ${deathYear} (${deathYear - birthYear} yrs)`;
        } else if (birthYear) {
          lifespan = m.isLiving ? `b. ${birthYear} (${new Date().getFullYear() - birthYear} yrs)` : `b. ${birthYear}`;
        }

        oldestAncestor = {
          id: m._id.toString(),
          name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
          gender: m.gender || 'UNKNOWN',
          generation: m.generation || 1,
          dateOfBirth: m.dateOfBirth,
          birthYear,
          birthPlace: m.birthPlace,
          isLiving: m.isLiving ?? false,
          profilePhoto: m.profilePhoto,
          occupation: m.occupation,
          ageOrLifespan: lifespan,
        };
      }
    });

    // ==========================================
    // D. MOST DOCUMENTED RELATIVES
    // ==========================================
    const memberMemoryCount = new Map<string, number>();
    memoryDocs.forEach((mem: any) => {
      (mem.memberIds || []).forEach((mid: any) => {
        const idStr = mid.toString();
        memberMemoryCount.set(idStr, (memberMemoryCount.get(idStr) || 0) + 1);
      });
    });

    const memberEventCount = new Map<string, number>();
    eventDocs.forEach((ev: any) => {
      (ev.memberIds || []).forEach((mid: any) => {
        const idStr = mid.toString();
        memberEventCount.set(idStr, (memberEventCount.get(idStr) || 0) + 1);
      });
    });

    const documentedList: DocumentedRelativeInsight[] = memberDocs.map((m: any) => {
      const mid = m._id.toString();
      const memCount = memberMemoryCount.get(mid) || 0;
      const evCount = memberEventCount.get(mid) || 0;
      const hasBio = Boolean(m.biography && m.biography.trim().length > 10);
      const totalItems = memCount + evCount + (hasBio ? 2 : 0);
      const bNames = (m.branchIds || []).map((b: any) => branchMap.get(b.toString())?.name || 'Main Branch');

      return {
        id: mid,
        name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        generation: m.generation || 1,
        profilePhoto: m.profilePhoto,
        branchNames: bNames,
        memoryCount: memCount,
        eventCount: evCount,
        hasBiography: hasBio,
        totalItems,
      };
    });

    documentedList.sort((a, b) => b.totalItems - a.totalItems);
    const mostDocumentedRelatives = documentedList.slice(0, 6);

    // ==========================================
    // E. MEMORY-RICH PERIODS & PEAK DECADE
    // ==========================================
    const decadeCounts = new Map<number, number>();
    memoryDocs.forEach((m: any) => {
      let year: number | null = null;
      if (m.eventDate) {
        year = new Date(m.eventDate).getFullYear();
      } else if (m.eventDateApprox) {
        const match = m.eventDateApprox.match(/\b(19\d\d|20\d\d)\b/);
        if (match) year = parseInt(match[1], 10);
      }
      if (year && !isNaN(year)) {
        const decadeStart = Math.floor(year / 10) * 10;
        decadeCounts.set(decadeStart, (decadeCounts.get(decadeStart) || 0) + 1);
      }
    });

    let peakDecadeYear: number | null = null;
    let peakDecadeCount = 0;
    decadeCounts.forEach((count, decade) => {
      if (count > peakDecadeCount) {
        peakDecadeCount = count;
        peakDecadeYear = decade;
      }
    });

    const memoryRichPeriods: MemoryPeriodInsight[] = Array.from(decadeCounts.entries())
      .map(([startYear, count]) => ({
        decade: `${startYear}s`,
        startYear,
        endYear: startYear + 9,
        memoryCount: count,
        isPeak: startYear === peakDecadeYear,
      }))
      .sort((a, b) => a.startYear - b.startYear);

    const peakMemoryDecade = peakDecadeYear ? `${peakDecadeYear}s` : null;

    // ==========================================
    // F. MOST ACTIVE CONTRIBUTORS
    // ==========================================
    const contributorStats = new Map<string, { memories: number; events: number }>();
    memoryDocs.forEach((m: any) => {
      const uid = m.createdBy?.toString();
      if (uid) {
        const curr = contributorStats.get(uid) || { memories: 0, events: 0 };
        curr.memories++;
        contributorStats.set(uid, curr);
      }
    });
    eventDocs.forEach((ev: any) => {
      const uid = ev.createdBy?.toString();
      if (uid) {
        const curr = contributorStats.get(uid) || { memories: 0, events: 0 };
        curr.events++;
        contributorStats.set(uid, curr);
      }
    });

    const userIds = Array.from(contributorStats.keys()).filter((id) => Types.ObjectId.isValid(id));
    const userDocs = await User.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } }).lean();
    const userMap = new Map<string, any>();
    userDocs.forEach((u: any) => userMap.set(u._id.toString(), u));

    const activeContributors: ActiveContributorInsight[] = Array.from(contributorStats.entries()).map(
      ([uid, counts]) => {
        const user = userMap.get(uid);
        return {
          id: uid,
          name: user?.name || 'Family Contributor',
          role: user?.role || 'Family Historian',
          memoriesCount: counts.memories,
          eventsCount: counts.events,
          totalContributions: counts.memories + counts.events,
        };
      }
    );
    activeContributors.sort((a, b) => b.totalContributions - a.totalContributions);

    // ==========================================
    // G. FREQUENTLY CONNECTED PLACES
    // ==========================================
    const placeCounts = new Map<string, { count: number; types: Set<'BIRTH' | 'DEATH' | 'MEMORY' | 'EVENT'> }>();
    const registerPlace = (rawPlace: string | undefined, type: 'BIRTH' | 'DEATH' | 'MEMORY' | 'EVENT') => {
      if (!rawPlace || !rawPlace.trim()) return;
      const clean = rawPlace.trim();
      const existing = placeCounts.get(clean) || { count: 0, types: new Set() };
      existing.count++;
      existing.types.add(type);
      placeCounts.set(clean, existing);
    };

    memberDocs.forEach((m: any) => {
      registerPlace(m.birthPlace, 'BIRTH');
      registerPlace(m.deathPlace, 'DEATH');
    });
    memoryDocs.forEach((m: any) => registerPlace(m.location, 'MEMORY'));
    eventDocs.forEach((ev: any) => registerPlace(ev.location, 'EVENT'));

    const connectedPlaces: ConnectedPlaceInsight[] = Array.from(placeCounts.entries())
      .map(([place, info]) => ({
        place,
        count: info.count,
        sourceTypes: Array.from(info.types),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ==========================================
    // H. IMPORTANT FAMILY ERAS
    // ==========================================
    const eraDefinitions = [
      { name: 'Founding Roots & Ancestry', timeframe: 'Pre-1960', minYear: 0, maxYear: 1959 },
      { name: 'Migration & Mid-Century', timeframe: '1960 – 1979', minYear: 1960, maxYear: 1979 },
      { name: 'Family Growth & New Horizons', timeframe: '1980 – 1999', minYear: 1980, maxYear: 1999 },
      { name: 'The Millennial Expansion', timeframe: '2000 – 2019', minYear: 2000, maxYear: 2019 },
      { name: 'Modern Living Chronicle', timeframe: '2020 – Present', minYear: 2020, maxYear: 2099 },
    ];

    const importantEras: FamilyEraInsight[] = eraDefinitions.map((def) => {
      let eCount = 0;
      let mCount = 0;

      eventDocs.forEach((ev: any) => {
        let y: number | null = null;
        if (ev.eventDate) y = new Date(ev.eventDate).getFullYear();
        if (y && y >= def.minYear && y <= def.maxYear) eCount++;
      });

      memoryDocs.forEach((mem: any) => {
        let y: number | null = null;
        if (mem.eventDate) y = new Date(mem.eventDate).getFullYear();
        else if (mem.eventDateApprox) {
          const match = mem.eventDateApprox.match(/\b(19\d\d|20\d\d)\b/);
          if (match) y = parseInt(match[1], 10);
        }
        if (y && y >= def.minYear && y <= def.maxYear) mCount++;
      });

      return {
        eraName: def.name,
        timeframe: def.timeframe,
        eventCount: eCount,
        memoryCount: mCount,
        summary: `${mCount} treasured memories and ${eCount} milestone events documented during this era.`,
      };
    });

    // ==========================================
    // I. HERITAGE GAPS & DOCUMENTATION HEALTH
    // ==========================================
    const missingBirthYearMembers = memberDocs
      .filter((m: any) => !m.dateOfBirth || m.dateOfBirth.trim() === '')
      .map((m: any) => ({
        id: m._id.toString(),
        name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        generation: m.generation || 1,
        profilePhoto: m.profilePhoto,
      }));

    const unverifiedRelationships = relationshipDocs
      .filter((r: any) => r.status === RelationshipStatus.PENDING || r.metadata?.isVerified === false)
      .map((r: any) => {
        const src = memberDocs.find((m: any) => m._id.toString() === r.sourceMemberId.toString());
        const tgt = memberDocs.find((m: any) => m._id.toString() === r.targetMemberId.toString());
        return {
          id: r._id.toString(),
          sourceName: src ? src.displayName || `${src.firstName} ${src.lastName}`.trim() : 'Unknown Member',
          targetName: tgt ? tgt.displayName || `${tgt.firstName} ${tgt.lastName}`.trim() : 'Unknown Member',
          relationshipType: r.relationshipType,
        };
      });

    const relativesWithoutMemories = memberDocs
      .filter((m: any) => (memberMemoryCount.get(m._id.toString()) || 0) === 0)
      .map((m: any) => ({
        id: m._id.toString(),
        name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
        generation: m.generation || 1,
        profilePhoto: m.profilePhoto,
      }));

    const heritageGaps: HeritageGapItem[] = [];

    if (missingBirthYearMembers.length > 0) {
      heritageGaps.push({
        id: 'gap_birth_years',
        type: 'MISSING_BIRTH_YEAR',
        title: `${missingBirthYearMembers.length} relatives have no birth year`,
        description: 'Adding approximate or verified birth years anchors your family members accurately on the generational timeline.',
        count: missingBirthYearMembers.length,
        severity: missingBirthYearMembers.length > 5 ? 'HIGH' : 'MEDIUM',
        actionLabel: 'Review Members',
        actionTarget: '/family/members?filter=missing_birth',
        members: missingBirthYearMembers.slice(0, 8),
      });
    }

    if (unverifiedRelationships.length > 0) {
      heritageGaps.push({
        id: 'gap_unverified_relationships',
        type: 'RELATIONSHIP_VERIFICATION',
        title: `${unverifiedRelationships.length} relationships need verification`,
        description: 'Confirm or verify newly added kinship bonds to ensure tree integrity and lineage path accuracy.',
        count: unverifiedRelationships.length,
        severity: 'MEDIUM',
        actionLabel: 'Verify Relationships',
        actionTarget: '/family/tree?filter=unverified',
        relationships: unverifiedRelationships.slice(0, 8),
      });
    }

    if (relativesWithoutMemories.length > 0) {
      heritageGaps.push({
        id: 'gap_missing_memories',
        type: 'MISSING_MEMORIES',
        title: `${relativesWithoutMemories.length} relatives have no memories tagged`,
        description: 'Bring personal histories to life by adding photographs, audio recollections, or stories for these relatives.',
        count: relativesWithoutMemories.length,
        severity: relativesWithoutMemories.length > 3 ? 'MEDIUM' : 'LOW',
        actionLabel: 'Add Memory',
        actionTarget: '/family/memories?action=new',
        members: relativesWithoutMemories.slice(0, 8),
      });
    }

    // ==========================================
    // J. MEMORY COVERAGE BY GENERATION
    // ==========================================
    const memoryCoverageByGeneration: GenerationCoverageInsight[] = [];
    for (let gen = minGen; gen <= maxGen; gen++) {
      const genMembers = membersByGen.get(gen) || [];
      const totalInGen = genMembers.length;
      if (totalInGen === 0) continue;

      let documentedInGen = 0;
      const documentedMems: any[] = [];
      const undocumentedMems: any[] = [];

      genMembers.forEach((m: any) => {
        const memCount = memberMemoryCount.get(m._id.toString()) || 0;
        const item = {
          id: m._id.toString(),
          name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
          profilePhoto: m.profilePhoto,
        };
        if (memCount > 0) {
          documentedInGen++;
          documentedMems.push(item);
        } else {
          undocumentedMems.push(item);
        }
      });

      const pct = Math.round((documentedInGen / totalInGen) * 100);
      let genLabel = `Generation ${gen}`;
      if (gen === 1) genLabel = 'Generation 1 (Founding Ancestors)';
      else if (gen === 2) genLabel = 'Generation 2 (Elders & Parents)';
      else if (gen === 3) genLabel = 'Generation 3 (Current Generation)';
      else if (gen >= 4) genLabel = `Generation ${gen} (Youth & Grandchildren)`;

      let genMemoriesCount = 0;
      genMembers.forEach((m: any) => {
        genMemoriesCount += memberMemoryCount.get(m._id.toString()) || 0;
      });

      memoryCoverageByGeneration.push({
        generation: gen,
        generationLabel: genLabel,
        memberCount: totalInGen,
        memoryCount: genMemoriesCount,
        coveragePercentage: pct,
        documentedCount: documentedInGen,
        undocumentedCount: totalInGen - documentedInGen,
        documentedMembers: documentedMems,
        undocumentedMembers: undocumentedMems,
      });

      if (pct < 40 && totalInGen >= 2) {
        heritageGaps.push({
          id: `gap_gen_${gen}`,
          type: 'LIMITED_GENERATION_DOC',
          title: `Generation ${gen} has limited documentation (${pct}% covered)`,
          description: `Only ${documentedInGen} of ${totalInGen} relatives in ${genLabel} have recorded stories or photographs.`,
          count: totalInGen - documentedInGen,
          severity: 'LOW',
          actionLabel: 'Add Memory',
          actionTarget: '/family/memories?action=new',
          members: undocumentedMems.slice(0, 6),
        });
      }
    }

    // ==========================================
    // K. TIMELINE INSIGHTS (Periods & Status)
    // ==========================================
    const allDecades = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
    const timelineInsights: TimelineInsightPeriod[] = allDecades.map((d) => {
      const mCount = decadeCounts.get(d) || 0;
      let eCount = 0;
      eventDocs.forEach((ev: any) => {
        if (ev.eventDate) {
          const y = new Date(ev.eventDate).getFullYear();
          if (y >= d && y <= d + 9) eCount++;
        }
      });

      let status: 'MEMORY_RICH' | 'ACTIVE_EVENTS' | 'SPARSE' | 'BALANCED' = 'SPARSE';
      let description = 'Few recorded milestones or photographs from this decade.';

      if (mCount >= 4) {
        status = 'MEMORY_RICH';
        description = 'Highly documented era with rich family photos, stories, and audio memories.';
      } else if (eCount >= 3) {
        status = 'ACTIVE_EVENTS';
        description = 'Numerous milestone family gatherings, weddings, and celebrations recorded.';
      } else if (mCount > 0 || eCount > 0) {
        status = 'BALANCED';
        description = 'Moderate documentation with foundational memories and key life events.';
      }

      return {
        decade: `${d}s`,
        timeframe: `${d} – ${d + 9}`,
        memoryCount: mCount,
        eventCount: eCount,
        status,
        description,
      };
    });

    // ==========================================
    // L. OVERALL STATISTICS
    // ==========================================
    const relationshipsByType: Record<string, number> = {};
    relationshipDocs.forEach((r: any) => {
      const t = r.relationshipType || 'OTHER';
      relationshipsByType[t] = (relationshipsByType[t] || 0) + 1;
    });

    const memoriesByType: Record<string, number> = {};
    memoryDocs.forEach((m: any) => {
      const t = m.memoryType || 'PHOTO';
      memoriesByType[t] = (memoriesByType[t] || 0) + 1;
    });

    const statistics: FamilyStatistics = {
      totalRelatives: memberDocs.length,
      livingCount,
      deceasedCount,
      generationsCount: totalGenerations,
      branchesCount: branchDocs.length,
      relationshipsCount: relationshipDocs.length,
      memoriesCount: memoryDocs.length,
      eventsCount: eventDocs.length,
      collectionsCount: collectionDocs.length,
      relationshipsByType,
      memoriesByType,
    };

    // ==========================================
    // M. FRIENDLY INSIGHT CARDS (Requirement 11 & 12)
    // ==========================================
    const cards: InsightCard[] = [
      {
        id: 'card_generations',
        headline: `Your family tree spans ${totalGenerations} generations`,
        subtext: `From founding patriarchs and matriarchs in Gen ${minGen} down to youth in Gen ${maxGen}.`,
        category: 'GENERATIONS',
        icon: 'GitFork',
      },
      {
        id: 'card_branch',
        headline: largestBranch ? `Most documented branch: ${largestBranch.name}` : 'Family branches mapped',
        subtext: largestBranch
          ? `Comprises ${largestBranch.memberCount} relatives (${largestBranch.percentage}% of your family tree).`
          : 'Create branches to segment distinct family lineages.',
        category: 'BRANCHES',
        icon: 'Layers',
      },
      {
        id: 'card_memories',
        headline: peakMemoryDecade
          ? `Your archive has the most memories from the ${peakMemoryDecade}`
          : 'Preserving family memories',
        subtext: peakMemoryDecade
          ? `${peakDecadeCount} memories captured across photos, stories, audio, documents, and recipes.`
          : 'Add photos, stories, audio, documents, and recipes across each decade.',
        category: 'MEMORIES',
        icon: 'Sparkles',
      },
      {
        id: 'card_gaps',
        headline: missingBirthYearMembers.length > 0
          ? `${missingBirthYearMembers.length} relatives are missing birth-year information`
          : 'High documentation completeness',
        subtext: missingBirthYearMembers.length > 0
          ? 'Add missing dates to reinforce genealogical accuracy on the visual tree.'
          : 'All family members have recorded birth milestones.',
        category: 'GAPS',
        icon: 'ShieldAlert',
      },
    ];

    // ==========================================
    // N. SMART SEARCH SUGGESTIONS (Requirement 9)
    // ==========================================
    const smartSuggestions: string[] = [];
    if (largestBranch) {
      smartSuggestions.push(`People from ${largestBranch.name}`);
    }
    if (peakMemoryDecade) {
      smartSuggestions.push(`Memories from the ${peakMemoryDecade}`);
    }
    if (oldestAncestor) {
      smartSuggestions.push(`Relatives connected to ${(oldestAncestor as any).name}`);
    }
    if (mostDocumentedRelatives[0]) {
      smartSuggestions.push(`Photos containing ${mostDocumentedRelatives[0].name}'s memories`);
    }
    if (connectedPlaces[0]) {
      smartSuggestions.push(`Milestones in ${connectedPlaces[0].place}`);
    }

    const response: FamilyInsightsResponse = {
      familyId,
      familyName,
      generationDepth: {
        minGeneration: minGen,
        maxGeneration: maxGen,
        totalGenerations,
        deepestDescendants,
      },
      largestBranch,
      oldestAncestor,
      mostDocumentedRelatives,
      memoryRichPeriods,
      peakMemoryDecade,
      activeContributors,
      connectedPlaces,
      importantEras,
      heritageGaps,
      memoryCoverageByGeneration,
      timelineInsights,
      statistics,
      cards,
      smartSuggestions,
    };

    insightCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return response;
  }

  /**
   * Detailed Branch Analytics
   */
  async getBranchInsights(familyId: string, actorUserId: string): Promise<BranchInsightDetail[]> {
    const fid = new Types.ObjectId(familyId);
    await this.getAuthorizedScope(familyId, actorUserId);

    const [branches, members, memories, events] = await Promise.all([
      Branch.find({ familyId: fid }).lean(),
      FamilyMember.find({ familyId: fid, isArchived: { $ne: true } }).lean(),
      Memory.find({ familyId: fid, status: MemoryStatus.ACTIVE }).lean(),
      FamilyEvent.find({ familyId: fid, status: 'ACTIVE' }).lean(),
    ]);

    const totalMembers = members.length;

    return branches.map((b: any) => {
      const bIdStr = b._id.toString();
      const branchMembers = members.filter((m: any) =>
        (m.branchIds || []).some((bid: any) => bid.toString() === bIdStr)
      );

      const mCount = branchMembers.length;
      const pct = totalMembers > 0 ? Math.round((mCount / totalMembers) * 100) : 0;

      const gens = new Set<number>();
      const growthByGeneration: Record<number, number> = {};

      branchMembers.forEach((m: any) => {
        const gen = m.generation || 1;
        gens.add(gen);
        growthByGeneration[gen] = (growthByGeneration[gen] || 0) + 1;
      });

      const sortedGens = Array.from(gens).sort((a, b) => a - b);
      const genRange = sortedGens.length > 0 ? `Gen ${sortedGens[0]} – Gen ${sortedGens[sortedGens.length - 1]}` : 'None';

      const branchMemberIds = new Set(branchMembers.map((m: any) => m._id.toString()));

      // Count memories tagged directly with branch or its members
      const branchMemories = memories.filter((mem: any) => {
        const hasBranch = (mem.branchIds || []).some((id: any) => id.toString() === bIdStr);
        const hasMember = (mem.memberIds || []).some((id: any) => branchMemberIds.has(id.toString()));
        return hasBranch || hasMember;
      });

      // Count events tagged directly with branch or its members
      const branchEvents = events.filter((ev: any) => {
        const hasBranch = (ev.branchIds || []).some((id: any) => id.toString() === bIdStr);
        const hasMember = (ev.memberIds || []).some((id: any) => branchMemberIds.has(id.toString()));
        return hasBranch || hasMember;
      });

      // Distinct contributors
      const contributorIds = new Set<string>();
      branchMemories.forEach((m: any) => {
        if (m.createdBy) contributorIds.add(m.createdBy.toString());
      });
      branchEvents.forEach((ev: any) => {
        if (ev.createdBy) contributorIds.add(ev.createdBy.toString());
      });

      return {
        id: bIdStr,
        name: b.name,
        accentColor: b.accentColor || '#0F8F72',
        description: b.description,
        memberCount: mCount,
        percentageOfFamily: pct,
        generations: sortedGens,
        generationRange: genRange,
        memoryCount: branchMemories.length,
        eventCount: branchEvents.length,
        contributorCount: contributorIds.size,
        growthByGeneration,
      };
    });
  }

  /**
   * Verifies an unverified relationship
   */
  async verifyRelationship(familyId: string, relationshipId: string, actorUserId: string) {
    const fid = new Types.ObjectId(familyId);
    const { isOwnerOrAdmin } = await this.getAuthorizedScope(familyId, actorUserId);

    if (!isOwnerOrAdmin) {
      throw new ForbiddenError('Only Family Owners or Admins can verify relationship records');
    }

    const rel = await Relationship.findOne({
      _id: new Types.ObjectId(relationshipId),
      familyId: fid,
    });

    if (!rel) {
      throw new NotFoundError('Relationship record not found');
    }

    rel.status = RelationshipStatus.ACTIVE;
    rel.metadata = {
      ...(rel.metadata || {}),
      isVerified: true,
      verifiedBy: actorUserId,
      verifiedAt: new Date().toISOString(),
    };
    await rel.save();

    // Clear cache
    this.clearCache(familyId);

    return rel;
  }
}

export const insightsService = new InsightsService();
