import { create } from 'zustand';
import { Family, FamilyMember, FamilyBranch, Memory, FamilyEvent, Relationship } from '../types/index.ts';
import { authenticatedFetch } from '../utils/api.ts';
import { useMemoryStore } from './useMemoryStore.ts';
import { useTimelineStore } from './useTimelineStore.ts';
import { resolveDynamicBranches } from '../utils/branchUtils.ts';

export const STORAGE_ACTIVE_FAMILY_KEY = 'familyroots_active_family_id';

interface FamilyState {
  currentFamily: Family;
  availableFamilies: Family[];
  activeFamilyId: string | null;
  members: FamilyMember[];
  branches: FamilyBranch[];
  relationships: Relationship[];
  memories: Memory[];
  events: FamilyEvent[];
  selectedMemberId: string | null;
  selectedBranchId: string | null;
  searchQuery: string;
  highlightedPathMemberIds: string[];
  isLoading: boolean;
  isLiveBackend: boolean;
  setSelectedMemberId: (id: string | null) => void;
  setSelectedBranchId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setHighlightedPathMemberIds: (ids: string[]) => void;
  getMemberById: (id: string) => FamilyMember | undefined;
  fetchAvailableFamilies: () => Promise<Family[]>;
  setActiveFamilyId: (familyId: string) => Promise<void>;
  createFamilyVault: (data: {
    name: string;
    description?: string;
    originPlace?: string;
    motto?: string;
    coverImage?: string;
  }) => Promise<Family>;
  fetchFamilyTree: (familyId?: string) => Promise<void>;
  updateMemberProfile: (memberId: string, data: Partial<any>) => Promise<FamilyMember | null>;
}

const emptyFamily: Family = {
  id: '',
  name: 'Family Vault',
  description: '',
  originPlace: '',
  motto: '',
  createdAt: '',
  totalMembers: 0,
  totalBranches: 0,
  totalMemories: 0,
};

export const useFamilyStore = create<FamilyState>((set, get) => ({
  currentFamily: emptyFamily,
  availableFamilies: [],
  activeFamilyId: null,
  members: [],
  branches: [],
  relationships: [],
  memories: [],
  events: [],
  selectedMemberId: null,
  selectedBranchId: null,
  searchQuery: '',
  highlightedPathMemberIds: [],
  isLoading: false,
  isLiveBackend: false,

  setSelectedMemberId: (id: string | null) => set({ selectedMemberId: id }),
  setSelectedBranchId: (id: string | null) => set({ selectedBranchId: id }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setHighlightedPathMemberIds: (ids: string[]) => set({ highlightedPathMemberIds: ids }),
  getMemberById: (id: string) => get().members.find((m) => m.id === id),

  fetchAvailableFamilies: async (): Promise<Family[]> => {
    try {
      const res = await authenticatedFetch('/api/families');
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return [];

      const families: Family[] = json.data.map((f: any) => ({
        id: (f.id || f._id)?.toString(),
        name: f.name || 'Family Vault',
        description: f.description || '',
        originPlace: f.originPlace || '',
        motto: f.motto || '',
        coverImage: f.coverImage || '',
        createdAt: f.createdAt || '',
        totalMembers: f.totalMembers || 0,
        totalBranches: f.totalBranches || 0,
        totalMemories: f.totalMemories || 0,
      }));

      set({ availableFamilies: families });

      // Auto-establish active family if currently unset or invalid
      const currentActiveId = get().activeFamilyId;
      const currentFamId = get().currentFamily?.id;
      let targetId = currentActiveId || currentFamId;

      if (!targetId) {
        try {
          const stored = localStorage.getItem(STORAGE_ACTIVE_FAMILY_KEY);
          if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim().length > 0) {
            targetId = stored.trim();
          }
        } catch {}
      }

      // If targetId is a family name or display label, resolve to real ID
      if (targetId && families.length > 0) {
        const byNameOrId = families.find(
          (f) => f.id === targetId || f.name.toLowerCase() === targetId!.toLowerCase()
        );
        if (byNameOrId) {
          targetId = byNameOrId.id;
        } else if (!families.some((f) => f.id === targetId)) {
          targetId = families[0].id;
        }
      } else if (families.length > 0) {
        targetId = families[0].id;
      }

      if (targetId) {
        const activeFamily = families.find((f) => f.id === targetId) || families[0];
        set({
          activeFamilyId: activeFamily.id,
          currentFamily: activeFamily,
        });
        try {
          localStorage.setItem(STORAGE_ACTIVE_FAMILY_KEY, activeFamily.id);
        } catch {}
      }

      return families;
    } catch {
      return [];
    }
  },

  setActiveFamilyId: async (familyId: string) => {
    if (!familyId) return;

    let resolvedId = familyId;
    const available = get().availableFamilies;
    if (available.length > 0) {
      const match = available.find(
        (f) => f.id === familyId || f.name.toLowerCase() === familyId.toLowerCase()
      );
      if (match) {
        resolvedId = match.id;
      }
    }

    try {
      localStorage.setItem(STORAGE_ACTIVE_FAMILY_KEY, resolvedId);
    } catch {}

    const matching = get().availableFamilies.find((f) => f.id === resolvedId);
    set({
      activeFamilyId: resolvedId,
      ...(matching ? { currentFamily: matching } : {}),
    });

    await get().fetchFamilyTree(resolvedId);

    // Synchronize downstream stores with new family context
    try {
      useMemoryStore.getState().fetchMemories(resolvedId);
      useMemoryStore.getState().fetchStats(resolvedId);
      useTimelineStore.getState().fetchTimeline(resolvedId);
    } catch {}
  },

  createFamilyVault: async (data: {
    name: string;
    description?: string;
    originPlace?: string;
    motto?: string;
    coverImage?: string;
  }): Promise<Family> => {
    const res = await authenticatedFetch('/api/families', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        originPlace: data.originPlace?.trim() || undefined,
        motto: data.motto?.trim() || undefined,
        coverImage: data.coverImage || undefined,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json.data) {
      throw new Error(json?.message || 'Failed to establish new family vault');
    }

    const created = json.data;
    const createdId = (created.id || created._id)?.toString();
    const newFamily: Family = {
      id: createdId,
      name: created.name,
      description: created.description || '',
      originPlace: created.originPlace || '',
      motto: created.motto || '',
      coverImage: created.coverImage || '',
      createdAt: created.createdAt || new Date().toISOString(),
      totalMembers: 0,
      totalBranches: 0,
      totalMemories: 0,
    };

    const currentAvailable = get().availableFamilies.filter((f) => f.id !== newFamily.id);
    const updatedAvailable = [newFamily, ...currentAvailable];

    try {
      localStorage.setItem(STORAGE_ACTIVE_FAMILY_KEY, newFamily.id);
    } catch {}

    set({
      availableFamilies: updatedAvailable,
      activeFamilyId: newFamily.id,
      currentFamily: newFamily,
      members: [],
      branches: [],
      relationships: [],
    });

    await get().fetchFamilyTree(newFamily.id);

    // Synchronize downstream stores with new family context immediately
    try {
      useMemoryStore.getState().fetchMemories(newFamily.id);
      useMemoryStore.getState().fetchStats(newFamily.id);
      useTimelineStore.getState().fetchTimeline(newFamily.id);
    } catch {}

    return newFamily;
  },

  fetchFamilyTree: async (targetFamilyId?: string) => {
    set({ isLoading: true });
    try {
      let famId = targetFamilyId;

      // 1. If not directly provided, check current activeFamilyId or currentFamily.id
      if (!famId) {
        famId = get().activeFamilyId || get().currentFamily?.id || undefined;
      }

      // 2. If still not found, restore from localStorage
      if (!famId) {
        try {
          const stored = localStorage.getItem(STORAGE_ACTIVE_FAMILY_KEY);
          if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim().length > 0) {
            famId = stored.trim();
          }
        } catch {}
      }

      // 3. Fetch available families from server
      const available = await get().fetchAvailableFamilies();

      // If famId is a name or not in available families, resolve it
      if (famId && available.length > 0) {
        const matched = available.find(
          (f) => f.id === famId || f.name.toLowerCase() === famId!.toLowerCase()
        );
        if (matched) {
          famId = matched.id;
        } else {
          famId = available[0].id;
        }
      } else if (!famId && available.length > 0) {
        famId = available[0].id;
      }

      if (!famId) {
        set({
          activeFamilyId: null,
          currentFamily: emptyFamily,
          members: [],
          branches: [],
          relationships: [],
          memories: [],
          events: [],
          isLoading: false,
          isLiveBackend: true,
        });
        try {
          localStorage.removeItem(STORAGE_ACTIVE_FAMILY_KEY);
        } catch {}
        return;
      }

      // Immediately set the active family state so currentFamily.id is not empty
      const activeFam = available.find((f) => f.id === famId);
      if (activeFam) {
        set({ activeFamilyId: famId, currentFamily: activeFam });
      } else {
        set({ activeFamilyId: famId });
      }

      // Persist active family ID for page refresh & session survival
      try {
        localStorage.setItem(STORAGE_ACTIVE_FAMILY_KEY, famId);
      } catch {}

      const treeRes = await authenticatedFetch(`/api/families/${famId}/tree`);
      if (!treeRes.ok) {
        if (treeRes.status === 404 || treeRes.status === 401 || treeRes.status === 403) {
          try {
            localStorage.removeItem(STORAGE_ACTIVE_FAMILY_KEY);
          } catch {}
          const refreshed = await get().fetchAvailableFamilies();
          const fallback = refreshed.find((f) => f.id !== famId) || (refreshed.length > 0 ? refreshed[0] : null);
          if (fallback && fallback.id !== famId) {
            set({ activeFamilyId: fallback.id, currentFamily: fallback });
            try {
              localStorage.setItem(STORAGE_ACTIVE_FAMILY_KEY, fallback.id);
            } catch {}
            return get().fetchFamilyTree(fallback.id);
          }
        }
        set({ activeFamilyId: famId, isLoading: false });
        return;
      }

      const treeJson = await treeRes.json();
      if (!treeJson.success || !treeJson.data) {
        set({ activeFamilyId: famId, isLoading: false });
        return;
      }

      const { family, members = [], relationships = [], branches = [] } = treeJson.data;

      // Transform backend tree data to frontend format
      const mappedFamily: Family = {
        id: (family.id || family._id)?.toString() || famId,
        name: family.name || activeFam?.name || 'Family Vault',
        description: family.description || activeFam?.description || '',
        originPlace: family.originPlace || activeFam?.originPlace || '',
        motto: family.motto || activeFam?.motto || '',
        createdAt: family.createdAt || activeFam?.createdAt || '',
        totalMembers: members.length,
        totalBranches: branches.length,
        totalMemories: get().memories.length,
      };

      const mappedBranches: FamilyBranch[] = branches.map(
        (b: { id: string; name: string; description?: string; rootMemberId: string; accentColor?: string }) => {
          const rootMem = members.find(
            (m: { id: string; displayName?: string; firstName: string; lastName: string }) => m.id === b.rootMemberId
          );
          const memCount = members.filter((m: { branchIds?: string[] }) => (m.branchIds || []).includes(b.id)).length;
          return {
            id: b.id,
            familyId: family.id || family._id,
            name: b.name,
            description: b.description || '',
            rootMemberId: b.rootMemberId,
            rootMemberName: rootMem
              ? rootMem.displayName || `${rootMem.firstName} ${rootMem.lastName}`
              : 'Branch Ancestor',
            memberCount: memCount || 1,
            accentColor: b.accentColor || '#059669',
          };
        }
      );

      const branchMap = new Map(mappedBranches.map((b) => [b.id, b.name]));

      // Derive marriage dates from SPOUSE relationships for both partners
      const memberMarriageDates = new Map<string, string>();
      relationships.forEach((r: { relationshipType?: string; sourceMemberId?: string; targetMemberId?: string; marriageDate?: string | null; metadata?: any }) => {
        const mDate = r.marriageDate || r.metadata?.marriageDate;
        if (r.relationshipType === 'SPOUSE' && mDate && r.sourceMemberId && r.targetMemberId) {
          memberMarriageDates.set(r.sourceMemberId.toString(), mDate);
          memberMarriageDates.set(r.targetMemberId.toString(), mDate);
        }
      });

      const mappedMembers: FamilyMember[] = members.map(
        (m: {
          id: string;
          firstName: string;
          lastName: string;
          displayName?: string;
          gender: string;
          dateOfBirth?: string;
          dateOfDeath?: string;
          isLiving: boolean;
          birthPlace?: string;
          occupation?: string;
          biography?: string;
          generation: number;
          branchIds?: string[];
          profilePhoto?: string;
        }) => {
          const primaryBranchId = m.branchIds && m.branchIds.length > 0 ? m.branchIds[0] : undefined;
          const derivedMarriageDate = memberMarriageDates.get(m.id) || (m as any).dateOfMarriage || (m as any).marriageDate || undefined;
          return {
            id: m.id,
            familyId: family.id || family._id,
            firstName: m.firstName,
            lastName: m.lastName,
            displayName: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
            gender: m.gender as 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN',
            dateOfBirth: m.dateOfBirth,
            dateOfDeath: m.dateOfDeath,
            isLiving: m.isLiving,
            dateOfMarriage: derivedMarriageDate,
            marriageDate: derivedMarriageDate,
            birthPlace: m.birthPlace,
            occupation: m.occupation,
            biography: m.biography,
            generation: m.generation,
            siblingOrder: (m as any).siblingOrder ?? (m as any).displayOrder ?? null,
            displayOrder: (m as any).displayOrder ?? (m as any).siblingOrder ?? null,
            createdAt: (m as any).createdAt,
            branchId: primaryBranchId,
            branchName: primaryBranchId ? branchMap.get(primaryBranchId) : undefined,
            memoryCount: 0,
            profilePhoto: m.profilePhoto,
            avatar: m.profilePhoto,
          };
        }
      );

      const mappedRelationships: Relationship[] = relationships.map(
        (r: {
          id: string;
          familyId: string;
          sourceMemberId: string;
          targetMemberId: string;
          relationshipType: string;
          status: string;
          marriageDate?: string | null;
          metadata?: Record<string, unknown>;
        }) => ({
          id: r.id,
          familyId: r.familyId,
          sourceMemberId: r.sourceMemberId,
          targetMemberId: r.targetMemberId,
          relationshipType: r.relationshipType as Relationship['relationshipType'],
          status: r.status as Relationship['status'],
          marriageDate: r.marriageDate || (r.metadata as any)?.marriageDate || null,
          siblingOrder: (r as any).siblingOrder ?? (r as any).displayOrder ?? (r.metadata as any)?.siblingOrder ?? null,
          displayOrder: (r as any).displayOrder ?? (r as any).siblingOrder ?? (r.metadata as any)?.displayOrder ?? null,
          createdAt: (r as any).createdAt,
          metadata: r.metadata || {},
        })
      );

      const resolvedMembers = resolveDynamicBranches(mappedMembers, mappedRelationships);

      // Collect all unique branches from resolved members to ensure mappedBranches includes them
      const dynamicBranchMap = new Map<string, FamilyBranch>();
      mappedBranches.forEach((b) => dynamicBranchMap.set(b.name, b));

      const branchColors = ['#059669', '#0284c7', '#d97706', '#6366f1', '#e11d48', '#8b5cf6', '#0d9488'];
      let colorIdx = mappedBranches.length;

      resolvedMembers.forEach((m) => {
        if (m.branchName && !dynamicBranchMap.has(m.branchName)) {
          const color = branchColors[colorIdx % branchColors.length];
          colorIdx++;
          const bSlug = m.branchId || `branch-${m.branchName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          const newBranch: FamilyBranch = {
            id: bSlug,
            familyId: mappedFamily.id,
            name: m.branchName,
            description: `${m.branchName} of ${mappedFamily.name}`,
            rootMemberId: m.id,
            rootMemberName: m.displayName,
            memberCount: 1,
            accentColor: color,
          };
          dynamicBranchMap.set(m.branchName, newBranch);
        }
      });

      // Update memberCounts
      dynamicBranchMap.forEach((branch) => {
        branch.memberCount = resolvedMembers.filter((m) => m.branchName === branch.name).length;
      });

      const finalBranches = Array.from(dynamicBranchMap.values());

      set({
        activeFamilyId: mappedFamily.id,
        currentFamily: mappedFamily,
        members: resolvedMembers,
        branches: finalBranches,
        relationships: mappedRelationships,
        isLoading: false,
        isLiveBackend: true,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  updateMemberProfile: async (memberId: string, data: Partial<any>): Promise<FamilyMember | null> => {
    try {
      const famId = get().activeFamilyId || get().currentFamily?.id;
      if (!famId) throw new Error('No active family vault selected');

      const res = await authenticatedFetch(`/api/families/${famId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || json?.error?.message || 'Failed to update member profile');
      }

      await get().fetchFamilyTree(famId);
      const updated = get().members.find((m) => m.id === memberId);
      return updated || null;
    } catch (err: any) {
      console.error('Error updating member:', err);
      throw err;
    }
  },
}));
