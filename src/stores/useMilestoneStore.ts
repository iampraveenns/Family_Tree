import { create } from 'zustand';
import {
  FamilyEvent,
  MilestoneGrouped,
  MilestoneSummary,
  EventType,
  MilestoneImportance,
} from '../types/index.ts';
import { api } from '../utils/api.ts';

export type MilestoneTimeframe = 'all' | 'upcoming' | 'today' | 'month' | 'historical' | 'past';
export type MilestoneViewMode = 'list' | 'calendar';

interface MilestoneFilters {
  eventType: string;
  importance: string;
  memberId: string;
  branchId: string;
  search: string;
}

interface MilestoneState {
  milestones: FamilyEvent[];
  grouped: MilestoneGrouped;
  summary: MilestoneSummary;
  activeTimeframe: MilestoneTimeframe;
  viewMode: MilestoneViewMode;
  selectedMilestone: FamilyEvent | null;
  isCreateModalOpen: boolean;
  isDetailDrawerOpen: boolean;
  createPresetType: EventType | null;

  // Calendar state
  calendarMonth: number; // 0-11
  calendarYear: number;

  filters: MilestoneFilters;
  isLoading: boolean;
  error: string | null;

  // UI state actions
  setTimeframe: (timeframe: MilestoneTimeframe) => void;
  setViewMode: (viewMode: MilestoneViewMode) => void;
  setSelectedMilestone: (milestone: FamilyEvent | null) => void;
  openCreateModal: (presetType?: EventType | null) => void;
  closeCreateModal: () => void;
  openDetailDrawer: (milestone: FamilyEvent) => void;
  closeDetailDrawer: () => void;
  setCalendarMonthYear: (month: number, year: number) => void;
  nextCalendarMonth: () => void;
  prevCalendarMonth: () => void;
  setFilters: (updates: Partial<MilestoneFilters>) => void;
  resetFilters: () => void;

  // Async API actions
  fetchMilestones: (familyId: string) => Promise<void>;
  createMilestone: (familyId: string, data: Partial<FamilyEvent>) => Promise<FamilyEvent>;
  updateMilestone: (familyId: string, id: string, data: Partial<FamilyEvent>) => Promise<FamilyEvent>;
  deleteMilestone: (familyId: string, id: string) => Promise<void>;
}

const defaultSummary: MilestoneSummary = {
  total: 0,
  today: 0,
  upcoming: 0,
  thisMonth: 0,
  historical: 0,
  past: 0,
};

const defaultGrouped: MilestoneGrouped = {
  today: [],
  upcoming: [],
  thisMonth: [],
  historicalAnniversaries: [],
  past: [],
};

const defaultFilters: MilestoneFilters = {
  eventType: 'ALL',
  importance: 'ALL',
  memberId: '',
  branchId: '',
  search: '',
};

export const useMilestoneStore = create<MilestoneState>((set, get) => {
  const currentDate = new Date();

  return {
    milestones: [],
    grouped: defaultGrouped,
    summary: defaultSummary,
    activeTimeframe: 'all',
    viewMode: 'list',
    selectedMilestone: null,
    isCreateModalOpen: false,
    isDetailDrawerOpen: false,
    createPresetType: null,

    calendarMonth: currentDate.getMonth(),
    calendarYear: currentDate.getFullYear(),

    filters: defaultFilters,
    isLoading: false,
    error: null,

    setTimeframe: (timeframe: MilestoneTimeframe) => {
      set({ activeTimeframe: timeframe });
    },

    setViewMode: (viewMode: MilestoneViewMode) => {
      set({ viewMode });
    },

    setSelectedMilestone: (milestone: FamilyEvent | null) => {
      set({ selectedMilestone: milestone });
    },

    openCreateModal: (presetType?: EventType | null) => {
      set({
        isCreateModalOpen: true,
        createPresetType: presetType || null,
      });
    },

    closeCreateModal: () => {
      set({
        isCreateModalOpen: false,
        createPresetType: null,
      });
    },

    openDetailDrawer: (milestone: FamilyEvent) => {
      set({
        selectedMilestone: milestone,
        isDetailDrawerOpen: true,
      });
    },

    closeDetailDrawer: () => {
      set({
        isDetailDrawerOpen: false,
      });
    },

    setCalendarMonthYear: (month: number, year: number) => {
      set({ calendarMonth: month, calendarYear: year });
    },

    nextCalendarMonth: () => {
      const { calendarMonth, calendarYear } = get();
      if (calendarMonth === 11) {
        set({ calendarMonth: 0, calendarYear: calendarYear + 1 });
      } else {
        set({ calendarMonth: calendarMonth + 1 });
      }
    },

    prevCalendarMonth: () => {
      const { calendarMonth, calendarYear } = get();
      if (calendarMonth === 0) {
        set({ calendarMonth: 11, calendarYear: calendarYear - 1 });
      } else {
        set({ calendarMonth: calendarMonth - 1 });
      }
    },

    setFilters: (updates: Partial<MilestoneFilters>) => {
      set((state) => ({
        filters: { ...state.filters, ...updates },
      }));
    },

    resetFilters: () => {
      set({ filters: defaultFilters });
    },

    fetchMilestones: async (familyId: string) => {
      set({ isLoading: true, error: null });
      const { filters } = get();

      try {
        const queryParams = new URLSearchParams();
        if (filters.eventType && filters.eventType !== 'ALL') {
          queryParams.append('eventType', filters.eventType);
        }
        if (filters.importance && filters.importance !== 'ALL') {
          queryParams.append('importance', filters.importance);
        }
        if (filters.memberId) {
          queryParams.append('memberId', filters.memberId);
        }
        if (filters.branchId) {
          queryParams.append('branchId', filters.branchId);
        }
        if (filters.search) {
          queryParams.append('search', filters.search);
        }

        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const response: any = await api.get(`/api/families/${familyId}/milestones${queryString}`);

        if (response.success && response.data) {
          const milestones = response.data;
          const grouped = response.grouped || defaultGrouped;
          const summary = response.summary || {
            total: milestones.length,
            today: grouped.today?.length || 0,
            upcoming: grouped.upcoming?.length || 0,
            thisMonth: grouped.thisMonth?.length || 0,
            historical: grouped.historicalAnniversaries?.length || 0,
            past: grouped.past?.length || 0,
          };

          set({
            milestones,
            grouped,
            summary,
            isLoading: false,
          });
        }
      } catch (err: any) {
        console.warn('Could not fetch milestones from API:', err.message);
        set({
          error: err.message || 'Failed to fetch milestones',
          isLoading: false,
        });
      }
    },

    createMilestone: async (familyId: string, data: Partial<FamilyEvent>) => {
      set({ isLoading: true, error: null });
      try {
        const response: any = await api.post(`/api/families/${familyId}/milestones`, {
          ...data,
          isMilestone: true,
        });

        if (response.success && response.data) {
          const newMilestone = response.data;
          // Refresh list
          await get().fetchMilestones(familyId);
          set({ isLoading: false, isCreateModalOpen: false });
          return newMilestone;
        }
        throw new Error(response.message || 'Failed to create milestone');
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },

    updateMilestone: async (familyId: string, id: string, data: Partial<FamilyEvent>) => {
      set({ isLoading: true, error: null });
      try {
        const response: any = await api.patch(`/api/families/${familyId}/milestones/${id}`, data);
        if (response.success && response.data) {
          const updated = response.data;
          await get().fetchMilestones(familyId);
          if (get().selectedMilestone?.id === id) {
            set({ selectedMilestone: updated });
          }
          set({ isLoading: false });
          return updated;
        }
        throw new Error(response.message || 'Failed to update milestone');
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },

    deleteMilestone: async (familyId: string, id: string) => {
      set({ isLoading: true, error: null });
      try {
        const response: any = await api.delete(`/api/families/${familyId}/milestones/${id}`);
        if (response.success) {
          await get().fetchMilestones(familyId);
          if (get().selectedMilestone?.id === id) {
            set({ selectedMilestone: null, isDetailDrawerOpen: false });
          }
          set({ isLoading: false });
          return;
        }
        throw new Error(response.message || 'Failed to delete milestone');
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },
  };
});
