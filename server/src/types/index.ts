import { Role, RelationshipType, Permission, ErrorCode } from '../constants/index.ts';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: unknown;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  roles?: {
    familyId: string;
    role: Role;
    branchId?: string;
  }[];
}

export interface FamilyDTO {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  createdBy: string;
  rootMemberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemberDTO {
  id: string;
  familyId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  nickname?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  profilePhoto?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  isLiving: boolean;
  birthPlace?: string;
  deathPlace?: string;
  houseName?: string;
  location?: string;
  occupation?: string;
  education?: string;
  biography?: string;
  isLinkedToUser?: boolean;
  linkedUserId?: string;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipDTO {
  id: string;
  familyId: string;
  sourceMemberId: string;
  targetMemberId: string;
  relationshipType: RelationshipType;
  status: 'ACTIVE' | 'PENDING' | 'HISTORICAL';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchDTO {
  id: string;
  familyId: string;
  name: string;
  description?: string;
  rootMemberId: string;
  managerUserId?: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryDTO {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  date?: string;
  location?: string;
  mediaType: 'PHOTO' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STORY';
  mediaUrl?: string;
  storageKey?: string;
  relatedMemberIds: string[];
  branchId?: string;
  tags?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
