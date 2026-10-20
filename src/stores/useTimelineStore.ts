import { create } from 'zustand';
import { FamilyEvent, EventType, FamilyStoryChapter } from '../types/index.ts';
import { api } from '../utils/api.ts';

export type TimelineViewMode = 'ALL' | 'MEMBER' | 'BRANCH' | 'GENERATION' | 'STORY';

interface TimelineFilterState {
  viewMode: TimelineViewMode;
  selectedMemberId: string | null;
  selectedBranchId: string | null;
  selectedGeneration: number | null;
  selectedEventType: EventType | 'ALL';
  selectedYear: number | null;
  selectedEra: string | null;
  searchQuery: string;
}

interface TimelineState {
  events: FamilyEvent[];
  storyChapters: FamilyStoryChapter[];
  onThisDayEvents: FamilyEvent[];
  upcomingAnniversaries: FamilyEvent[];
  availableEras: string[];
  selectedEvent: FamilyEvent | null;
  isCreateModalOpen: boolean;
  isDetailDrawerOpen: boolean;
  isLoading: boolean;
  isStoryLoading: boolean;
  error: string | null;

  // Pagination
  page: number;
  limit: number;
  total: number;
  totalPages: number;

  // Filter state
  filters: TimelineFilterState;

  // Actions
  setViewMode: (mode: TimelineViewMode) => void;
  setFilters: (updates: Partial<TimelineFilterState>) => void;
  resetFilters: () => void;
  setSelectedEvent: (event: FamilyEvent | null) => void;
  setIsCreateModalOpen: (open: boolean) => void;
  setIsDetailDrawerOpen: (open: boolean) => void;

  // Async API actions
  fetchTimeline: (familyId: string, page?: number) => Promise<void>;
  fetchStoryChapters: (familyId: string) => Promise<void>;
  fetchOnThisDay: (familyId: string) => Promise<void>;
  fetchUpcomingAnniversaries: (familyId: string) => Promise<void>;
  createEvent: (familyId: string, data: Partial<FamilyEvent>) => Promise<FamilyEvent>;
  updateEvent: (familyId: string, eventId: string, data: Partial<FamilyEvent>) => Promise<FamilyEvent>;
  deleteEvent: (familyId: string, eventId: string) => Promise<void>;
}

const defaultFilters: TimelineFilterState = {
  viewMode: 'ALL',
  selectedMemberId: null,
  selectedBranchId: null,
  selectedGeneration: null,
  selectedEventType: 'ALL',
  selectedYear: null,
  selectedEra: null,
  searchQuery: '',
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: [],
  storyChapters: [],
  onThisDayEvents: [],
  upcomingAnniversaries: [],
  availableEras: [],
  selectedEvent: null,
  isCreateModalOpen: false,
  isDetailDrawerOpen: false,
  isLoading: false,
  isStoryLoading: false,
  error: null,

  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,

  filters: defaultFilters,

  setViewMode: (mode: TimelineViewMode) => {
    set((state) => ({
      filters: {
        ...state.filters,
        viewMode: mode,
      },
    }));
  },

  setFilters: (updates: Partial<TimelineFilterState>) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...updates,
      },
    }));
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
  },

  setSelectedEvent: (event: FamilyEvent | null) => {
    set({
      selectedEvent: event,
      isDetailDrawerOpen: !!event,
    });
  },

  setIsCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),
  setIsDetailDrawerOpen: (open: boolean) => {
    set({
      isDetailDrawerOpen: open,
      selectedEvent: open ? get().selectedEvent : null,
    });
  },

  fetchTimeline: async (familyId: string, pageNum = 1) => {
    set({ isLoading: true, error: null });
    try {
      const { filters, limit } = get();
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', limit.toString());

      if (filters.selectedEventType !== 'ALL') {
        params.append('eventType', filters.selectedEventType);
      }
      if (filters.selectedMemberId) {
        params.append('memberId', filters.selectedMemberId);
      }
      if (filters.selectedBranchId) {
        params.append('branchId', filters.selectedBranchId);
      }
      if (filters.selectedYear) {
        params.append('year', filters.selectedYear.toString());
      }
      if (filters.selectedEra) {
        params.append('era', filters.selectedEra);
      }
      if (filters.searchQuery.trim()) {
        params.append('search', filters.searchQuery.trim());
      }
      if (filters.viewMode !== 'ALL' && filters.viewMode !== 'STORY') {
        params.append('view', filters.viewMode);
      }

      const res = await api.get<{
        success: boolean;
        data: {
          events: FamilyEvent[];
          pagination: { total: number; page: number; limit: number; pages: number };
          eras: string[];
        };
      }>(`/families/${familyId}/timeline?${params.toString()}`);

      if (res.data?.data) {
        const { events, pagination, eras } = res.data.data;
        set({
          events: pageNum === 1 ? events : [...get().events, ...events],
          page: pagination.page,
          total: pagination.total,
          totalPages: pagination.pages,
          availableEras: eras || [],
          isLoading: false,
        });
      }
    } catch (err: any) {
      set({
        error: err.response?.data?.error?.message || err.message || 'Failed to load timeline events',
        isLoading: false,
      });
    }
  },

  fetchStoryChapters: async (familyId: string) => {
    set({ isStoryLoading: true });
    try {
      const res = await api.get<{
        success: boolean;
        data: FamilyStoryChapter[];
      }>(`/families/${familyId}/timeline/story`);

      if (res.data?.data) {
        set({
          storyChapters: res.data.data,
          isStoryLoading: false,
        });
      }
    } catch (err: any) {
      set({ isStoryLoading: false });
    }
  },

  fetchOnThisDay: async (familyId: string) => {
    try {
      const res = await api.get<{
        success: boolean;
        data: FamilyEvent[];
      }>(`/families/${familyId}/timeline/on-this-day`);

      if (res.data?.data) {
        set({ onThisDayEvents: res.data.data });
      }
    } catch {
      // Non-critical fallback
    }
  },

  fetchUpcomingAnniversaries: async (familyId: string) => {
    try {
      const res = await api.get<{
        success: boolean;
        data: FamilyEvent[];
      }>(`/families/${familyId}/timeline/upcoming-anniversaries`);

      if (res.data?.data) {
        set({ upcomingAnniversaries: res.data.data });
      }
    } catch {
      // Non-critical fallback
    }
  },

  createEvent: async (familyId: string, data: Partial<FamilyEvent>) => {
    const res = await api.post<{
      success: boolean;
      data: FamilyEvent;
    }>(`/families/${familyId}/events`, data);

    const newEvent = res.data.data;
    set((state) => ({
      events: [newEvent, ...state.events],
      total: state.total + 1,
      isCreateModalOpen: false,
    }));

    // Refresh story chapters and stats
    get().fetchStoryChapters(familyId);
    return newEvent;
  },

  updateEvent: async (familyId: string, eventId: string, data: Partial<FamilyEvent>) => {
    const res = await api.patch<{
      success: boolean;
      data: FamilyEvent;
    }>(`/families/${familyId}/events/${eventId}`, data);

    const updated = res.data.data;
    set((state) => ({
      events: state.events.map((e) => (e.id === eventId ? updated : e)),
      selectedEvent: state.selectedEvent?.id === eventId ? updated : state.selectedEvent,
    }));

    get().fetchStoryChapters(familyId);
    return updated;
  },

  deleteEvent: async (familyId: string, eventId: string) => {
    await api.delete(`/families/${familyId}/events/${eventId}`);
    set((state) => ({
      events: state.events.filter((e) => e.id !== eventId),
      total: Math.max(0, state.total - 1),
      selectedEvent: null,
      isDetailDrawerOpen: false,
    }));

    get().fetchStoryChapters(familyId);
  },
}));
