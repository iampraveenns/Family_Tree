import { create } from 'zustand';
import {
  FamilyMembershipItem,
  FamilyInvitationItem,
  AuditLogItem,
  UserPermissionsExplanation,
  RoleType,
  ChangeProposalItem,
  NotificationItem,
  ActivityFeedItem,
} from '../types/index.ts';
import { getAuthTokenOrEnsure, authenticatedFetch } from '../utils/api.ts';

interface CollaborationState {
  memberships: FamilyMembershipItem[];
  invitations: FamilyInvitationItem[];
  auditLogs: AuditLogItem[];
  auditTotal: number;
  userPermissions: UserPermissionsExplanation | null;
  proposals: ChangeProposalItem[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  activityFeed: ActivityFeedItem[];
  isLoading: boolean;
  isActionLoading: boolean;
  error: string | null;
  lastCopiedInviteToken: string | null;

  // Actions
  fetchAdminData: (familyId: string) => Promise<void>;
  fetchMemberships: (familyId: string) => Promise<void>;
  fetchInvitations: (familyId: string) => Promise<void>;
  fetchAuditLogs: (familyId: string, filters?: { action?: string; entityType?: string; page?: number; limit?: number }) => Promise<void>;
  fetchPermissions: (familyId: string) => Promise<void>;
  fetchProposals: (familyId: string, status?: string) => Promise<void>;
  createProposal: (familyId: string, data: {
    entityType: 'MEMBER' | 'RELATIONSHIP' | 'MEMORY' | 'EVENT' | 'BIOGRAPHY';
    changeType?: 'CREATE' | 'UPDATE' | 'DELETE';
    entityId?: string;
    title: string;
    description?: string;
    details?: Record<string, any>;
  }) => Promise<{ success: boolean; proposal?: any; error?: string }>;
  approveProposal: (familyId: string, proposalId: string, reviewNotes?: string) => Promise<{ success: boolean; error?: string }>;
  rejectProposal: (familyId: string, proposalId: string, reviewNotes?: string) => Promise<{ success: boolean; error?: string }>;
  fetchNotifications: (familyId: string, unreadOnly?: boolean) => Promise<void>;
  markNotificationRead: (familyId: string, notificationId: string) => Promise<void>;
  markAllNotificationsRead: (familyId: string) => Promise<void>;
  fetchActivityFeed: (familyId: string, limit?: number) => Promise<void>;
  linkMemberToMembership: (familyId: string, membershipId: string, memberId: string | null) => Promise<{ success: boolean; error?: string }>;
  
  inviteMember: (familyId: string, data: {
    email: string;
    role: RoleType;
    branchId?: string;
    targetMemberId?: string;
  }) => Promise<{ success: boolean; rawToken?: string; error?: string }>;

  resendInvitation: (familyId: string, invitationId: string) => Promise<{ success: boolean; rawToken?: string; error?: string }>;
  revokeInvitation: (familyId: string, invitationId: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (familyId: string, membershipId: string, role: RoleType) => Promise<{ success: boolean; error?: string }>;
  updateMemberStatus: (familyId: string, membershipId: string, status: 'ACTIVE' | 'SUSPENDED') => Promise<{ success: boolean; error?: string }>;
  
  createBranch: (familyId: string, data: {
    name: string;
    description?: string;
    rootMemberId: string;
    accentColor?: string;
  }) => Promise<{ success: boolean; branch?: any; error?: string }>;

  archiveBranch: (familyId: string, branchId: string, isArchived: boolean) => Promise<{ success: boolean; error?: string }>;
  assignBranchManagers: (familyId: string, branchId: string, managerIds: string[]) => Promise<{ success: boolean; error?: string }>;
  transferMember: (familyId: string, sourceBranchId: string, memberId: string, targetBranchId: string) => Promise<{ success: boolean; error?: string }>;
  
  setLastCopiedInviteToken: (token: string | null) => void;
  clearError: () => void;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  memberships: [],
  invitations: [],
  auditLogs: [],
  auditTotal: 0,
  userPermissions: null,
  proposals: [],
  notifications: [],
  unreadNotificationCount: 0,
  activityFeed: [],
  isLoading: false,
  isActionLoading: false,
  error: null,
  lastCopiedInviteToken: null,

  setLastCopiedInviteToken: (token) => set({ lastCopiedInviteToken: token }),
  clearError: () => set({ error: null }),

  fetchAdminData: async (familyId: string) => {
    if (!familyId) return;
    set({ isLoading: true, error: null });
    try {
      await Promise.allSettled([
        get().fetchPermissions(familyId),
        get().fetchMemberships(familyId),
        get().fetchInvitations(familyId),
        get().fetchAuditLogs(familyId),
        get().fetchProposals(familyId),
        get().fetchNotifications(familyId),
        get().fetchActivityFeed(familyId),
      ]);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPermissions: async (familyId: string) => {
    if (!familyId) return;
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/memberships/my-permissions`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          set({ userPermissions: json.data });
        }
      }
    } catch (e) {
      console.warn('Could not fetch live permissions, using defaults', e);
    }
  },

  fetchMemberships: async (familyId: string) => {
    if (!familyId) return;
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/memberships`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ memberships: json.data });
        }
      }
    } catch (e) {
      console.warn('Could not fetch memberships', e);
    }
  },

  fetchInvitations: async (familyId: string) => {
    if (!familyId) return;
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/memberships/invitations`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          set({ invitations: json.data });
        }
      }
    } catch (e) {
      console.warn('Could not fetch invitations', e);
    }
  },

  fetchAuditLogs: async (familyId: string, filters) => {
    if (!familyId) return;
    try {
      const query = new URLSearchParams();
      if (filters?.action) query.set('action', filters.action);
      if (filters?.entityType) query.set('entityType', filters.entityType);
      if (filters?.limit) query.set('limit', filters.limit.toString());
      if (filters?.page) query.set('page', filters.page.toString());

      const res = await authenticatedFetch(`/api/families/${familyId}/memberships/audit-logs/all?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          set({
            auditLogs: json.data.logs || [],
            auditTotal: json.data.total || 0,
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch audit logs', e);
    }
  },

  inviteMember: async (familyId, data) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/memberships/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to send invitation';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      const newInvite = json.data.invitation;
      const rawToken = json.data.rawToken;

      set((state) => ({
        invitations: [
          {
            ...newInvite,
            rawToken,
          },
          ...state.invitations,
        ],
        lastCopiedInviteToken: rawToken,
        isActionLoading: false,
      }));

      // Refresh audit logs
      get().fetchAuditLogs(familyId);

      return { success: true, rawToken };
    } catch (err: any) {
      const msg = err.message || 'Network error sending invitation';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  resendInvitation: async (familyId, invitationId) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/memberships/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to resend invitation';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      const rawToken = json.data.rawToken;
      set((state) => ({
        invitations: state.invitations.map((inv) =>
          inv.id === invitationId || inv._id === invitationId
            ? { ...inv, status: 'PENDING', rawToken, expiresAt: json.data.invitation?.expiresAt || inv.expiresAt }
            : inv
        ),
        lastCopiedInviteToken: rawToken,
        isActionLoading: false,
      }));

      get().fetchAuditLogs(familyId);
      return { success: true, rawToken };
    } catch (err: any) {
      const msg = err.message || 'Error resending invitation';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  revokeInvitation: async (familyId, invitationId) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/memberships/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to revoke invitation';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      set((state) => ({
        invitations: state.invitations.filter((i) => i.id !== invitationId && i._id !== invitationId),
        isActionLoading: false,
      }));

      get().fetchAuditLogs(familyId);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error revoking invitation';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  updateMemberRole: async (familyId, membershipId, role) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/memberships/${membershipId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to update member role';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      set((state) => ({
        memberships: state.memberships.map((m) =>
          m.id === membershipId || m._id === membershipId ? { ...m, role } : m
        ),
        isActionLoading: false,
      }));

      get().fetchAuditLogs(familyId);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error updating member role';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  updateMemberStatus: async (familyId, membershipId, status) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/memberships/${membershipId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to update membership status';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      set((state) => ({
        memberships: state.memberships.map((m) =>
          m.id === membershipId || m._id === membershipId ? { ...m, status } : m
        ),
        isActionLoading: false,
      }));

      get().fetchAuditLogs(familyId);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error updating membership status';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  createBranch: async (familyId, data) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to create branch';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      get().fetchAuditLogs(familyId);
      set({ isActionLoading: false });
      return { success: true, branch: json.data };
    } catch (err: any) {
      const msg = err.message || 'Error creating branch';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  archiveBranch: async (familyId, branchId, isArchived) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/branches/${branchId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isArchived }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to update branch archive status';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      get().fetchAuditLogs(familyId);
      set({ isActionLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error archiving branch';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  assignBranchManagers: async (familyId, branchId, managerIds) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/branches/${branchId}/managers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ managerIds }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to assign branch managers';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      get().fetchAuditLogs(familyId);
      set({ isActionLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error assigning branch managers';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  transferMember: async (familyId, sourceBranchId, memberId, targetBranchId) => {
    set({ isActionLoading: true, error: null });
    try {
      const token = await getAuthTokenOrEnsure();
      const res = await fetch(`/api/families/${familyId}/branches/${sourceBranchId}/transfer-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ memberId, targetBranchId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to transfer member';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      get().fetchAuditLogs(familyId);
      set({ isActionLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error transferring member';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  fetchProposals: async (familyId, status) => {
    if (!familyId) return;
    try {
      const url = new URL(`/api/families/${familyId}/changes`, window.location.origin);
      if (status) url.searchParams.append('status', status);
      const res = await authenticatedFetch(url.toString());
      const json = await res.json();
      if (res.ok && json.success) {
        set({ proposals: json.data?.proposals || [] });
      }
    } catch {
      // Keep existing
    }
  },

  createProposal: async (familyId, data) => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to submit proposal';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      await Promise.all([
        get().fetchProposals(familyId),
        get().fetchActivityFeed(familyId),
      ]);
      set({ isActionLoading: false });
      return { success: true, proposal: json.data };
    } catch (err: any) {
      const msg = err.message || 'Error submitting proposal';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  approveProposal: async (familyId, proposalId, reviewNotes) => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/changes/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to approve proposal';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      await Promise.all([
        get().fetchProposals(familyId),
        get().fetchActivityFeed(familyId),
        get().fetchNotifications(familyId),
      ]);
      set({ isActionLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error approving proposal';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  rejectProposal: async (familyId, proposalId, reviewNotes) => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/changes/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to reject proposal';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      await Promise.all([
        get().fetchProposals(familyId),
        get().fetchActivityFeed(familyId),
        get().fetchNotifications(familyId),
      ]);
      set({ isActionLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error rejecting proposal';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },

  fetchNotifications: async (familyId, unreadOnly) => {
    if (!familyId) return;
    try {
      const url = new URL(`/api/families/${familyId}/notifications`, window.location.origin);
      if (unreadOnly) url.searchParams.append('unreadOnly', 'true');
      const res = await authenticatedFetch(url.toString());
      if (!res.ok) {
        return;
      }
      const json = await res.json();
      if (res.ok && json.success) {
        const items = json.data?.notifications || [];
        const unreadCount = json.data?.unreadCount ?? items.filter((n: any) => !n.isRead).length;
        set({ notifications: items, unreadNotificationCount: unreadCount });
      }
    } catch {
      // Keep existing
    }
  },

  markNotificationRead: async (familyId, notificationId) => {
    if (!familyId || !notificationId) return;
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      if (res.ok) {
        set((state) => {
          const updated = state.notifications.map((n) =>
            (n.id === notificationId || n._id === notificationId) ? { ...n, isRead: true } : n
          );
          const count = updated.filter((n) => !n.isRead).length;
          return { notifications: updated, unreadNotificationCount: count };
        });
      }
    } catch {
      // Ignore
    }
  },

  markAllNotificationsRead: async (familyId) => {
    if (!familyId) return;
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/notifications/read-all`, {
        method: 'POST',
      });
      if (res.ok) {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadNotificationCount: 0,
        }));
      }
    } catch {
      // Ignore
    }
  },

  fetchActivityFeed: async (familyId, limit = 25) => {
    if (!familyId) return;
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/activity?limit=${limit}`);
      const json = await res.json();
      if (res.ok && json.success) {
        set({ activityFeed: json.data || [] });
      }
    } catch {
      // Keep fallback
    }
  },

  linkMemberToMembership: async (familyId, membershipId, memberId) => {
    if (!familyId) return { success: false, error: 'Invalid family' };
    set({ isActionLoading: true, error: null });
    try {
      const res = await authenticatedFetch(`/api/families/${familyId}/memberships/${membershipId}/link-member`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to update member linkage';
        set({ error: msg, isActionLoading: false });
        return { success: false, error: msg };
      }

      await get().fetchMemberships(familyId);
      set({ isActionLoading: false });
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Error updating member linkage';
      set({ error: msg, isActionLoading: false });
      return { success: false, error: msg };
    }
  },
}));
