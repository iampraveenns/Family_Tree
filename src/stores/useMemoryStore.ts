import { create } from 'zustand';
import { Memory, MemoryType, VaultStats, MediaAsset, MemoryCollection } from '../types/index.ts';
import { apiRequest } from '../utils/api.ts';

interface MemoryStoreState {
  memories: Memory[];
  onThisDayMemories: Memory[];
  selectedMemory: Memory | null;
  stats: VaultStats | null;

  // Collections
  collections: MemoryCollection[];
  selectedCollectionId: string | null;
  activeCollection: MemoryCollection | null;
  isLoadingCollections: boolean;

  // View & Filter States
  filterType: string;
  filterBranchId: string | null;
  filterMemberId: string | null;
  filterTag: string | null;
  filterYear: string | null;
  filterDecade: string | null;
  searchQuery: string;
  viewMode: 'GRID' | 'LIST' | 'TIMELINE';

  // UI Flow States
  isLoading: boolean;
  isUploading: boolean;
  isDetailOpen: boolean;
  isCreateModalOpen: boolean;
  isCreateCollectionModalOpen: boolean;
  error: string | null;

  // Actions
  fetchMemories: (familyId: string) => Promise<void>;
  fetchOnThisDay: (familyId: string) => Promise<void>;
  fetchStats: (familyId: string) => Promise<void>;
  fetchCollections: (familyId: string) => Promise<void>;
  createCollection: (
    familyId: string,
    data: {
      title: string;
      description?: string;
      coverImageUrl?: string;
      coverMediaId?: string;
      memoryIds?: string[];
    }
  ) => Promise<MemoryCollection | null>;
  updateCollection: (
    familyId: string,
    collectionId: string,
    data: Partial<MemoryCollection>
  ) => Promise<MemoryCollection | null>;
  deleteCollection: (familyId: string, collectionId: string) => Promise<boolean>;
  addMemoryToCollection: (familyId: string, collectionId: string, memoryId: string) => Promise<void>;
  removeMemoryFromCollection: (familyId: string, collectionId: string, memoryId: string) => Promise<void>;
  setSelectedCollectionId: (id: string | null) => void;

  fetchMemoryDetails: (familyId: string, memoryId: string) => Promise<Memory | null>;
  createMemory: (
    familyId: string,
    memoryData: {
      title: string;
      description?: string;
      memoryType: MemoryType;
      eventDate?: string;
      eventDateApprox?: string;
      location?: string;
      visibility?: string;
      memberIds?: string[];
      branchIds?: string[];
      tags?: string[];
      collectionId?: string;
    },
    mediaFile?: File
  ) => Promise<Memory | null>;
  uploadMedia: (familyId: string, memoryId: string, file: File) => Promise<MediaAsset | null>;
  updateMemory: (
    familyId: string,
    memoryId: string,
    updates: Partial<Memory>
  ) => Promise<Memory | null>;
  deleteMedia: (mediaId: string, memoryId: string) => Promise<boolean>;
  archiveMemory: (familyId: string, memoryId: string) => Promise<boolean>;
  checkDuplicateMedia: (
    familyId: string,
    checksum: string
  ) => Promise<{ isDuplicate: boolean; existingMedia?: any; existingMemory?: any }>;

  // Filter setters
  setFilterType: (type: string) => void;
  setFilterBranchId: (branchId: string | null) => void;
  setFilterMemberId: (memberId: string | null) => void;
  setFilterTag: (tag: string | null) => void;
  setFilterYear: (year: string | null) => void;
  setFilterDecade: (decade: string | null) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'GRID' | 'LIST' | 'TIMELINE') => void;
  resetFilters: () => void;

  openDetail: (memory: Memory) => void;
  setSelectedMemory: (memory: Memory | null) => void;
  closeDetail: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openCreateCollectionModal: () => void;
  closeCreateCollectionModal: () => void;
  navigateToNextMemory: () => void;
  navigateToPrevMemory: () => void;
}

export const useMemoryStore = create<MemoryStoreState>((set, get) => ({
  memories: [],
  onThisDayMemories: [],
  selectedMemory: null,
  stats: null,

  collections: [],
  selectedCollectionId: null,
  activeCollection: null,
  isLoadingCollections: false,

  filterType: 'ALL',
  filterBranchId: null,
  filterMemberId: null,
  filterTag: null,
  filterYear: null,
  filterDecade: null,
  searchQuery: '',
  viewMode: 'GRID',

  isLoading: false,
  isUploading: false,
  isDetailOpen: false,
  isCreateModalOpen: false,
  isCreateCollectionModalOpen: false,
  error: null,

  fetchMemories: async (familyId) => {
    set({ isLoading: true, error: null });
    try {
      const {
        filterType,
        filterBranchId,
        filterMemberId,
        filterTag,
        filterYear,
        selectedCollectionId,
        searchQuery,
      } = get();

      const params = new URLSearchParams();
      if (filterType && filterType !== 'ALL') params.append('type', filterType);
      if (filterBranchId) params.append('branchId', filterBranchId);
      if (filterMemberId) params.append('memberId', filterMemberId);
      if (filterTag) params.append('tag', filterTag);
      if (filterYear) params.append('year', filterYear);
      if (selectedCollectionId) params.append('collectionId', selectedCollectionId);
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', '100');

      const res = await apiRequest(`/api/families/${familyId}/memories?${params.toString()}`);
      if (res.success && res.data) {
        const rawMemories: any[] = res.data.memories || [];
        const normalizedMemories: Memory[] = rawMemories.map((m) => {
          const addedById = m.addedByMemberId
            ? typeof m.addedByMemberId === 'object'
              ? (m.addedByMemberId._id || m.addedByMemberId.id)?.toString()
              : m.addedByMemberId.toString()
            : undefined;

          const addedByName =
            m.addedByMemberName ||
            (m.addedByMemberId && typeof m.addedByMemberId === 'object'
              ? (m.addedByMemberId.displayName || `${m.addedByMemberId.firstName || ''} ${m.addedByMemberId.lastName || ''}`.trim())
              : undefined);

          return {
            ...m,
            id: m._id || m.id,
            addedByMemberId: addedById,
            addedByMemberName: addedByName,
            memberIds: (m.memberIds || []).map((mb: any) => (typeof mb === 'object' ? mb._id || mb.id : mb)),
            branchIds: (m.branchIds || []).map((b: any) => (typeof b === 'object' ? b._id || b.id : b)),
            coverMedia: m.coverMediaId && typeof m.coverMediaId === 'object' ? m.coverMediaId : undefined,
            coverMediaId: m.coverMediaId ? (typeof m.coverMediaId === 'object' ? m.coverMediaId._id || m.coverMediaId.id : m.coverMediaId) : undefined,
          };
        });
        set({ memories: normalizedMemories, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch memories', isLoading: false });
    }
  },

  fetchOnThisDay: async (familyId) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/memories/on-this-day`);
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((m: any) => ({
          ...m,
          id: m._id || m.id,
          coverMedia: m.coverMediaId && typeof m.coverMediaId === 'object' ? m.coverMediaId : undefined,
        }));
        set({ onThisDayMemories: mapped });
      }
    } catch {
      // Ignored for non-fatal widget
    }
  },

  fetchStats: async (familyId) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/memories/stats`);
      if (res.success && res.data) {
        set({ stats: res.data });
      }
    } catch {
      // Handled
    }
  },

  fetchCollections: async (familyId) => {
    set({ isLoadingCollections: true });
    try {
      const res = await apiRequest(`/api/families/${familyId}/collections`);
      if (res.success && Array.isArray(res.data)) {
        const normalized = res.data.map((c: any) => ({
          ...c,
          id: c._id || c.id,
          memoryIds: (c.memoryIds || []).map((m: any) => (typeof m === 'object' ? m._id || m.id : m)),
        }));
        set({ collections: normalized, isLoadingCollections: false });

        // If selectedCollectionId is active, update activeCollection
        const currentSel = get().selectedCollectionId;
        if (currentSel) {
          const active = normalized.find((col: any) => col.id === currentSel) || null;
          set({ activeCollection: active });
        }
      } else {
        set({ isLoadingCollections: false });
      }
    } catch {
      set({ isLoadingCollections: false });
    }
  },

  createCollection: async (familyId, data) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/collections`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.success && res.data) {
        const col = { ...res.data, id: res.data._id || res.data.id };
        await get().fetchCollections(familyId);
        return col;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to create collection' });
    }
    return null;
  },

  updateCollection: async (familyId, collectionId, data) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/collections/${collectionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (res.success && res.data) {
        const col = { ...res.data, id: res.data._id || res.data.id };
        await get().fetchCollections(familyId);
        return col;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to update collection' });
    }
    return null;
  },

  deleteCollection: async (familyId, collectionId) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/collections/${collectionId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        if (get().selectedCollectionId === collectionId) {
          set({ selectedCollectionId: null, activeCollection: null });
        }
        await get().fetchCollections(familyId);
        return true;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete collection' });
    }
    return false;
  },

  addMemoryToCollection: async (familyId, collectionId, memoryId) => {
    try {
      await apiRequest(`/api/families/${familyId}/collections/${collectionId}/memories`, {
        method: 'POST',
        body: JSON.stringify({ memoryId }),
      });
      await get().fetchCollections(familyId);
    } catch {
      // Handled
    }
  },

  removeMemoryFromCollection: async (familyId, collectionId, memoryId) => {
    try {
      await apiRequest(
        `/api/families/${familyId}/collections/${collectionId}/memories/${memoryId}`,
        {
          method: 'DELETE',
        }
      );
      await get().fetchCollections(familyId);
    } catch {
      // Handled
    }
  },

  setSelectedCollectionId: (id) => {
    const active = id ? get().collections.find((c) => c.id === id) || null : null;
    set({ selectedCollectionId: id, activeCollection: active });
  },

  fetchMemoryDetails: async (familyId, memoryId) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/memories/${memoryId}`);
      if (res.success && res.data) {
        const fullMemory: Memory = {
          ...res.data,
          id: res.data._id || res.data.id,
          memberIds: (res.data.memberIds || []).map((mb: any) =>
            typeof mb === 'object' ? mb._id || mb.id : mb
          ),
          coverMedia:
            res.data.coverMediaId && typeof res.data.coverMediaId === 'object'
              ? res.data.coverMediaId
              : undefined,
        };
        set({ selectedMemory: fullMemory });
        return fullMemory;
      }
    } catch {
      // Handled
    }
    return null;
  },

  createMemory: async (familyId, memoryData, mediaFile) => {
    set({ isLoading: true, error: null });
    try {
      const { collectionId, ...cleanData } = memoryData;
      const res = await apiRequest(`/api/families/${familyId}/memories`, {
        method: 'POST',
        body: JSON.stringify(cleanData),
      });

      if (!res.success || !res.data) {
        throw new Error(res.error?.message || res.message || 'Failed to create memory');
      }

      const createdMemory: Memory = {
        ...res.data,
        id: res.data._id || res.data.id,
      };

      // If a media file was provided in the creation flow, upload it now
      if (mediaFile) {
        set({ isUploading: true });
        const uploadResult = await get().uploadMedia(familyId, createdMemory.id, mediaFile);
        if (uploadResult) {
          createdMemory.coverMedia = uploadResult;
          createdMemory.coverMediaId = uploadResult.id;
          createdMemory.media = [uploadResult];
        }
        set({ isUploading: false });
      }

      // If assigned to a collection, add it
      if (collectionId) {
        await get().addMemoryToCollection(familyId, collectionId, createdMemory.id);
      }

      // Refresh memories and stats
      await get().fetchMemories(familyId);
      await get().fetchStats(familyId);
      await get().fetchCollections(familyId);
      set({ isLoading: false, isCreateModalOpen: false });
      return createdMemory;
    } catch (err: any) {
      set({ error: err.message || 'Error creating memory', isLoading: false, isUploading: false });
      return null;
    }
  },

  uploadMedia: async (familyId, memoryId, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest(`/api/families/${familyId}/memories/${memoryId}/media`, {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data) {
        const mediaAsset: MediaAsset = {
          ...res.data,
          id: res.data._id || res.data.id,
        };

        // Update selectedMemory if open
        const cur = get().selectedMemory;
        if (cur && cur.id === memoryId) {
          const updatedMedia = [...(cur.media || []), mediaAsset];
          set({
            selectedMemory: {
              ...cur,
              media: updatedMedia,
              coverMedia: cur.coverMedia || mediaAsset,
              coverMediaId: cur.coverMediaId || mediaAsset.id,
            },
          });
        }
        return mediaAsset;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to upload media asset' });
    }
    return null;
  },

  updateMemory: async (familyId, memoryId, updates) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/memories/${memoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (res.success && res.data) {
        const updatedMemory: Memory = {
          ...res.data,
          id: res.data._id || res.data.id,
        };
        const currentList = get().memories.map((m) =>
          m.id === memoryId ? { ...m, ...updatedMemory } : m
        );
        set({
          memories: currentList,
          selectedMemory:
            get().selectedMemory?.id === memoryId
              ? { ...get().selectedMemory!, ...updatedMemory }
              : get().selectedMemory,
        });
        await get().fetchStats(familyId);
        return updatedMemory;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to update memory' });
    }
    return null;
  },

  deleteMedia: async (mediaId, memoryId) => {
    try {
      const res = await apiRequest(`/api/media/${mediaId}`, { method: 'DELETE' });
      if (res.success) {
        const cur = get().selectedMemory;
        if (cur && cur.id === memoryId) {
          const updatedMedia = (cur.media || []).filter((m) => m.id !== mediaId);
          set({
            selectedMemory: {
              ...cur,
              media: updatedMedia,
              coverMedia: cur.coverMediaId === mediaId ? updatedMedia[0] : cur.coverMedia,
              coverMediaId: cur.coverMediaId === mediaId ? updatedMedia[0]?.id : cur.coverMediaId,
            },
          });
        }
        return true;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete media file' });
    }
    return false;
  },

  archiveMemory: async (familyId, memoryId) => {
    try {
      const res = await apiRequest(`/api/families/${familyId}/memories/${memoryId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        set({
          memories: get().memories.filter((m) => m.id !== memoryId),
          selectedMemory: null,
          isDetailOpen: false,
        });
        await get().fetchStats(familyId);
        return true;
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to archive memory' });
    }
    return false;
  },

  checkDuplicateMedia: async (familyId, checksum) => {
    try {
      const res = await apiRequest(
        `/api/families/${familyId}/memories/check-duplicate?checksum=${encodeURIComponent(checksum)}`
      );
      if (res.success && res.data) {
        return res.data;
      }
    } catch {
      // Handled
    }
    return { isDuplicate: false };
  },

  setFilterType: (type) => {
    set({ filterType: type });
  },

  setFilterBranchId: (branchId) => {
    set({ filterBranchId: branchId });
  },

  setFilterMemberId: (memberId) => {
    set({ filterMemberId: memberId });
  },

  setFilterTag: (tag) => {
    set({ filterTag: tag });
  },

  setFilterYear: (year) => {
    set({ filterYear: year });
  },

  setFilterDecade: (decade) => {
    set({ filterDecade: decade });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  resetFilters: () => {
    set({
      filterType: 'ALL',
      filterBranchId: null,
      filterMemberId: null,
      filterTag: null,
      filterYear: null,
      filterDecade: null,
      searchQuery: '',
      selectedCollectionId: null,
      activeCollection: null,
    });
  },

  openDetail: (memory) => {
    set({ selectedMemory: memory, isDetailOpen: true });
  },

  setSelectedMemory: (memory) => {
    set({ selectedMemory: memory, isDetailOpen: !!memory });
  },

  closeDetail: () => {
    set({ isDetailOpen: false });
  },

  openCreateModal: () => {
    set({ isCreateModalOpen: true });
  },

  closeCreateModal: () => {
    set({ isCreateModalOpen: false });
  },

  openCreateCollectionModal: () => {
    set({ isCreateCollectionModalOpen: true });
  },

  closeCreateCollectionModal: () => {
    set({ isCreateCollectionModalOpen: false });
  },

  navigateToNextMemory: () => {
    const { memories, selectedMemory } = get();
    if (!selectedMemory || memories.length <= 1) return;
    const currentIndex = memories.findIndex((m) => m.id === selectedMemory.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % memories.length;
    set({ selectedMemory: memories[nextIndex] });
  },

  navigateToPrevMemory: () => {
    const { memories, selectedMemory } = get();
    if (!selectedMemory || memories.length <= 1) return;
    const currentIndex = memories.findIndex((m) => m.id === selectedMemory.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + memories.length) % memories.length;
    set({ selectedMemory: memories[prevIndex] });
  },
}));
