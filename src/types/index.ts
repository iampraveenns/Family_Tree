export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorTheme = 'heritage' | 'emerald' | 'amber';

export interface Family {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  motto?: string;
  originPlace?: string;
  createdAt: string;
  totalMembers: number;
  totalBranches: number;
  totalMemories: number;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export interface FamilyMember {
  id: string;
  familyId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  nickname?: string;
  gender: Gender;
  profilePhoto?: string;
  avatar?: string;
  avatarUrl?: string;
  profileImageUrl?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  dateOfMarriage?: string;
  marriageDate?: string;
  isLiving: boolean;
  birthPlace?: string;
  deathPlace?: string;
  houseName?: string;
  location?: string;
  occupation?: string;
  education?: string;
  biography?: string;
  generation: number;
  siblingOrder?: number | null;
  displayOrder?: number | null;
  createdAt?: string;
  branchId?: string;
  branchName?: string;
  memoryCount?: number;
  isLinkedToUser?: boolean;
  linkedUserId?: string;
  registeredEmail?: string;
}

export type Member = FamilyMember;

export type RelationshipCategory =
  | 'PARENT'
  | 'CHILD'
  | 'SPOUSE'
  | 'SIBLING'
  | 'HALF_SIBLING'
  | 'ADOPTIVE_PARENT'
  | 'ADOPTED_CHILD'
  | 'STEP_PARENT'
  | 'STEP_CHILD'
  | 'GUARDIAN';

export interface Relationship {
  id: string;
  familyId: string;
  sourceMemberId: string;
  targetMemberId: string;
  relationshipType: RelationshipCategory;
  status?: 'ACTIVE' | 'PENDING' | 'HISTORICAL';
  marriageDate?: string | null;
  siblingOrder?: number | null;
  displayOrder?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FamilyBranch {
  id: string;
  familyId: string;
  name: string;
  description: string;
  rootMemberId: string;
  rootMemberName: string;
  memberCount: number;
  accentColor: string;
  coverImage?: string;
}

export type MemoryType =
  | 'PHOTO'
  | 'VIDEO'
  | 'STORY'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'RECIPE';

export type MemoryVisibility = 'FAMILY' | 'BRANCH' | 'PRIVATE';

export interface MediaAsset {
  id: string;
  familyId: string;
  memoryId: string;
  uploadedBy?: string;
  originalFileName: string;
  storageKey?: string;
  mimeType: string;
  fileSize: number;
  sha256Checksum?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  streamUrl?: string;
  url?: string;
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  visibility: MemoryVisibility;
  createdAt: string;
}

export interface Memory {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  memoryType: MemoryType;
  createdBy?: string | { id: string; name: string };
  addedByMemberId?: string;
  addedByMemberName?: string;
  eventDate?: string;
  eventDateApprox?: string;
  location?: string;
  visibility: MemoryVisibility;
  memberIds: string[];
  branchIds: string[];
  tags: string[];
  coverMediaId?: string;
  coverMedia?: MediaAsset;
  coverMediaUrl?: string;
  collectionIds?: string[];
  media?: MediaAsset[];
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt?: string;

  // Compatibility aliases
  type?: MemoryType;
  date?: string;
  relatedMemberIds?: string[];
  mediaUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
}

export interface MemoryCollection {
  id: string;
  _id?: string;
  familyId: string;
  title: string;
  description?: string;
  coverMediaId?: string;
  coverImageUrl?: string;
  memoryIds: string[];
  createdBy?: any;
  status?: 'ACTIVE' | 'ARCHIVED';
  memoryCount: number;
  people: FamilyMember[];
  dateRange?: string;
  memories?: Memory[];
  createdAt: string;
  updatedAt?: string;
}

export interface VaultStats {
  totalMemories: number;
  totalMedia: number;
  totalStorageBytes: number;
  countsByType: Record<string, number>;
}

export type EventType =
  | 'BIRTH'
  | 'MARRIAGE'
  | 'DEATH'
  | 'MIGRATION'
  | 'EDUCATION'
  | 'CAREER'
  | 'MILITARY'
  | 'BIRTHDAY'
  | 'ANNIVERSARY'
  | 'MEMORIAL'
  | 'REUNION'
  | 'ACHIEVEMENT'
  | 'FAMILY_EVENT'
  | 'CUSTOM'
  | 'OTHER';

export const EventType = {
  BIRTH: 'BIRTH' as EventType,
  MARRIAGE: 'MARRIAGE' as EventType,
  DEATH: 'DEATH' as EventType,
  MIGRATION: 'MIGRATION' as EventType,
  EDUCATION: 'EDUCATION' as EventType,
  CAREER: 'CAREER' as EventType,
  MILITARY: 'MILITARY' as EventType,
  BIRTHDAY: 'BIRTHDAY' as EventType,
  ANNIVERSARY: 'ANNIVERSARY' as EventType,
  MEMORIAL: 'MEMORIAL' as EventType,
  REUNION: 'REUNION' as EventType,
  ACHIEVEMENT: 'ACHIEVEMENT' as EventType,
  FAMILY_EVENT: 'FAMILY_EVENT' as EventType,
  CUSTOM: 'CUSTOM' as EventType,
  OTHER: 'OTHER' as EventType,
};

export type EventVisibility = 'FAMILY' | 'BRANCH' | 'PRIVATE';
export const EventVisibility = {
  FAMILY: 'FAMILY' as EventVisibility,
  BRANCH: 'BRANCH' as EventVisibility,
  PRIVATE: 'PRIVATE' as EventVisibility,
};

export type RecurrenceFrequency = 'NONE' | 'YEARLY' | 'ANNUALLY' | 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
export const RecurrenceFrequency = {
  NONE: 'NONE' as RecurrenceFrequency,
  YEARLY: 'YEARLY' as RecurrenceFrequency,
  ANNUALLY: 'ANNUALLY' as RecurrenceFrequency,
  MONTHLY: 'MONTHLY' as RecurrenceFrequency,
  WEEKLY: 'WEEKLY' as RecurrenceFrequency,
  CUSTOM: 'CUSTOM' as RecurrenceFrequency,
};

export type MilestoneImportance = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export const MilestoneImportance = {
  LOW: 'LOW' as MilestoneImportance,
  NORMAL: 'NORMAL' as MilestoneImportance,
  HIGH: 'HIGH' as MilestoneImportance,
  CRITICAL: 'CRITICAL' as MilestoneImportance,
};

export interface ReminderSettings {
  enabled: boolean;
  daysBefore?: number[];
  notifyChannels?: ('EMAIL' | 'IN_APP' | 'SMS')[];
  customMessage?: string;
}

export interface FamilyEvent {
  id: string;
  _id?: string;
  familyId: string;
  title: string;
  description?: string;
  eventType: EventType;
  eventDate?: string;
  approximateDate?: string;
  era?: string;
  location?: string;
  memberIds: any[];
  branchIds: any[];
  memoryIds: (string | Memory)[];
  coverMediaId?: any;
  coverMedia?: MediaAsset;
  recurrence?: RecurrenceFrequency | { frequency: RecurrenceFrequency; interval?: number; endAfterOccurrences?: number; endDate?: string } | any;
  reminderSettings?: ReminderSettings;
  importance?: MilestoneImportance;
  notes?: string;
  isMilestone?: boolean;
  createdBy?: any;
  visibility: EventVisibility;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt?: string;

  // Calculated milestone fields
  daysAway?: number | null;
  nextOccurrenceDate?: string | Date | null;
  occurrenceYear?: number | null;
  yearsCount?: number | null;
  anniversaryLabel?: string;
  isToday?: boolean;
  isThisMonth?: boolean;
  isUpcoming?: boolean;
  isPast?: boolean;
  isHistorical?: boolean;

  // Compatibility aliases
  date?: string;
  type?: any;
  relatedMemberIds?: string[];
}

export interface MilestoneGrouped {
  today: FamilyEvent[];
  upcoming: FamilyEvent[];
  thisMonth: FamilyEvent[];
  historicalAnniversaries: FamilyEvent[];
  past: FamilyEvent[];
}

export interface MilestoneSummary {
  total: number;
  today: number;
  upcoming: number;
  thisMonth: number;
  historical: number;
  past: number;
}

export interface FamilyStoryChapter {
  id: string;
  era: string;
  title: string;
  summary: string;
  events: FamilyEvent[];
  featuredMemories: Memory[];
  membersInvolved: any[];
}

export type RoleType =
  | 'FAMILY_OWNER'
  | 'FAMILY_ADMIN'
  | 'BRANCH_MANAGER'
  | 'PARENT_MANAGER'
  | 'CONTRIBUTOR'
  | 'MEMBER'
  | 'VIEWER';

export interface FamilyMembershipItem {
  id: string;
  _id?: string;
  familyId: string;
  userId: {
    _id?: string;
    id?: string;
    email: string;
    displayName?: string;
    name?: string;
  } | string;
  role: RoleType;
  status: 'ACTIVE' | 'SUSPENDED';
  permissions: string[];
  memberId?: string;
  targetMemberId?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
}

export interface FamilyInvitationItem {
  id: string;
  _id?: string;
  familyId: string;
  email: string;
  role: RoleType;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED';
  invitedBy?: {
    email?: string;
    displayName?: string;
  } | string;
  expiresAt: string;
  targetMemberId?: string;
  branchId?: string;
  rawToken?: string;
  isExpired?: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  _id?: string;
  familyId: string;
  actorUserId?: string;
  actorName?: string;
  actorEmail?: string;
  actorDisplayName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface UserPermissionsExplanation {
  userId: string;
  familyId: string;
  role: RoleType;
  roleRank: number;
  status: 'ACTIVE' | 'SUSPENDED';
  linkedMember?: {
    id: string;
    name: string;
    profilePhoto?: string;
  } | null;
  branch?: {
    id: string;
    name: string;
    color?: string;
  } | null;
  permissions: string[];
  scope: {
    isFamilyWide: boolean;
    branchScope: string | null;
    parentScope: string | null;
  };
  capabilities: {
    canInviteMembers: boolean;
    canManageRoles: boolean;
    canManageBranches: boolean;
    canCreateMemories: boolean;
    canEditAllMembers: boolean;
    canViewAuditLogs: boolean;
  };
  whatYouCanDo: string[];
  whatYouCannotDo: string[];
  allowedActions: string[];
  prohibitedActions: string[];
}

export interface ChangeProposalItem {
  id: string;
  _id?: string;
  familyId: string;
  proposedBy: string;
  proposerName: string;
  proposerRole: RoleType;
  entityType: 'MEMBER' | 'RELATIONSHIP' | 'MEMORY' | 'EVENT' | 'BIOGRAPHY';
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  entityId?: string;
  title: string;
  description?: string;
  details: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationItem {
  id: string;
  _id?: string;
  familyId: string;
  recipientUserId: string;
  type:
    | 'INVITATION_RECEIVED'
    | 'INVITATION_ACCEPTED'
    | 'ROLE_CHANGED'
    | 'CONTRIBUTION_APPROVED'
    | 'CONTRIBUTION_REJECTED'
    | 'RELATIONSHIP_UPDATED'
    | 'MILESTONE_ALERT'
    | 'NEW_CONTRIBUTION'
    | 'MEMBER_ADDED'
    | 'MEMORY_ADDED';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  actorName?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ActivityFeedItem {
  id: string;
  actorName: string;
  actorEmail?: string;
  action: string;
  actionPhrase: string;
  actionType?: string;
  description?: string;
  targetEntityName?: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

