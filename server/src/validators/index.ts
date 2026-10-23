import { z } from 'zod';
import {
  RelationshipType,
  RelationshipStatus,
  BranchVisibility,
  EventType,
  EventVisibility,
  RecurrenceFrequency,
  MilestoneImportance,
} from '../constants/index.ts';

// -------------------------------------------------------------
// Family Schemas
// -------------------------------------------------------------
export const createFamilySchema = z.object({
  name: z.string().min(1, 'Family name is required').max(120),
  description: z.string().max(2000).optional(),
  coverImage: z.string().optional(),
  originPlace: z.string().max(200).optional(),
  motto: z.string().max(200).optional(),
  settings: z
    .object({
      defaultMemberVisibility: z.enum(['FAMILY', 'PUBLIC', 'PRIVATE']).optional(),
      allowMemberInvitations: z.boolean().optional(),
      allowPublicProfiles: z.boolean().optional(),
      timezone: z.string().optional(),
      dateFormat: z.string().optional(),
    })
    .optional(),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  coverImage: z.string().optional(),
  originPlace: z.string().max(200).optional(),
  motto: z.string().max(200).optional(),
  settings: z
    .object({
      defaultMemberVisibility: z.enum(['FAMILY', 'PUBLIC', 'PRIVATE']).optional(),
      allowMemberInvitations: z.boolean().optional(),
      allowPublicProfiles: z.boolean().optional(),
      timezone: z.string().optional(),
      dateFormat: z.string().optional(),
    })
    .optional(),
});

export const onboardingSetupSchema = z.object({
  family: z.object({
    name: z.string().min(1, 'Family name is required').max(120),
    originPlace: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    motto: z.string().max(200).optional(),
    coverImage: z.string().optional(),
  }),
  rootAncestor: z.object({
    firstName: z.string().min(1, 'Root ancestor first name is required').max(80),
    lastName: z.string().min(1, 'Root ancestor last name is required').max(80),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
    dateOfBirth: z.string().max(30).optional(),
    birthPlace: z.string().max(200).optional(),
    houseName: z.string().max(200).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    occupation: z.string().max(150).optional(),
    biography: z.string().max(5000).optional(),
    profilePhoto: z.string().optional(),
  }),
  immediateFamily: z
    .array(
      z.object({
        relation: z.enum(['SPOUSE', 'CHILD', 'PARENT']),
        firstName: z.string().min(1, 'First name is required').max(80),
        lastName: z.string().min(1, 'Last name is required').max(80),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
        dateOfBirth: z.string().max(30).optional(),
        profilePhoto: z.string().optional(),
      })
    )
    .optional(),
  firstMemory: z
    .object({
      title: z.string().min(1).max(200),
      memoryType: z.enum(['PHOTO', 'VIDEO', 'STORY', 'AUDIO', 'DOCUMENT', 'RECIPE']).optional(),
      description: z.string().max(5000).optional(),
      eventDate: z.string().optional(),
      location: z.string().max(200).optional(),
      tags: z.array(z.string()).optional(),
      mediaUrl: z.string().optional(),
    })
    .optional(),
  invitations: z
    .array(
      z.object({
        email: z.string().email('Valid email is required'),
        role: z.string().optional(),
      })
    )
    .optional(),
});

// -------------------------------------------------------------
// Member Schemas
// -------------------------------------------------------------
export const createMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(1, 'Last name is required').max(80),
  displayName: z.string().max(100).optional(),
  nickname: z.string().max(80).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).default('UNKNOWN'),
  profilePhoto: z.string().optional(),
  dateOfBirth: z.string().max(30).optional(),
  dateOfDeath: z.string().max(30).optional(),
  isLiving: z.boolean().default(true),
  birthPlace: z.string().max(200).optional(),
  deathPlace: z.string().max(200).optional(),
  houseName: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  occupation: z.string().max(150).optional(),
  education: z.string().max(150).optional(),
  biography: z.string().max(5000).optional(),
  branchIds: z.array(z.string()).optional(),
  generation: z.number().int().min(1).max(20).optional(),
  siblingOrder: z.number().int().min(0).optional().nullable(),
  email: z.string().optional(),
  registeredEmail: z.string().optional(),
  linkedUserId: z.string().optional(),
  privacySettings: z
    .object({
      visibility: z.enum(['FAMILY', 'PUBLIC', 'PRIVATE']).optional(),
      hideLivingDates: z.boolean().optional(),
    })
    .optional(),
});

export const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  middleName: z.string().max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  displayName: z.string().max(100).optional(),
  nickname: z.string().max(80).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
  profilePhoto: z.string().optional(),
  dateOfBirth: z.string().max(30).optional().nullable(),
  dateOfDeath: z.string().max(30).optional().nullable(),
  isLiving: z.boolean().optional(),
  birthPlace: z.string().max(200).optional().nullable(),
  deathPlace: z.string().max(200).optional().nullable(),
  houseName: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  occupation: z.string().max(150).optional().nullable(),
  education: z.string().max(150).optional(),
  biography: z.string().max(5000).optional(),
  branchIds: z.array(z.string()).optional(),
  generation: z.number().int().min(1).max(20).optional(),
  siblingOrder: z.number().int().min(0).optional().nullable(),
  displayOrder: z.number().int().min(0).optional().nullable(),
  privacySettings: z
    .object({
      visibility: z.enum(['FAMILY', 'PUBLIC', 'PRIVATE']).optional(),
      hideLivingDates: z.boolean().optional(),
    })
    .optional(),
});

export const queryMemberSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  branchId: z.string().optional(),
});

// -------------------------------------------------------------
// Relationship Schemas
// -------------------------------------------------------------
export const createRelationshipSchema = z
  .object({
    sourceMemberId: z.string().min(1, 'Source member ID is required'),
    targetMemberId: z.string().min(1, 'Target member ID is required'),
    relationshipType: z.nativeEnum(RelationshipType),
    status: z.nativeEnum(RelationshipStatus).default(RelationshipStatus.ACTIVE),
    marriageDate: z.string().optional().nullable(),
    siblingOrder: z.number().int().min(0).optional().nullable(),
    displayOrder: z.number().int().min(0).optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.sourceMemberId !== data.targetMemberId, {
    message: 'A member cannot form a relationship with themselves',
    path: ['targetMemberId'],
  });

export const updateRelationshipSchema = z.object({
  status: z.nativeEnum(RelationshipStatus).optional(),
  marriageDate: z.string().optional().nullable(),
  siblingOrder: z.number().int().min(0).optional().nullable(),
  displayOrder: z.number().int().min(0).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// -------------------------------------------------------------
// Branch Schemas
// -------------------------------------------------------------
export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100),
  description: z.string().max(1000).optional(),
  rootMemberId: z.string().min(1, 'Root member ID is required'),
  coverImage: z.string().optional(),
  accentColor: z.string().max(30).optional(),
  visibility: z.nativeEnum(BranchVisibility).default(BranchVisibility.FAMILY),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  rootMemberId: z.string().optional(),
  coverImage: z.string().optional(),
  accentColor: z.string().max(30).optional(),
  visibility: z.nativeEnum(BranchVisibility).optional(),
});

// -------------------------------------------------------------
// Milestone Schemas (Phase 6)
// -------------------------------------------------------------
export const createMilestoneSchema = z.object({
  title: z.string().min(1, 'Milestone title is required').max(200),
  description: z.string().max(2000).optional(),
  eventType: z.nativeEnum(EventType),
  eventDate: z.string().optional(),
  approximateDate: z.string().max(100).optional(),
  era: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  memberIds: z.array(z.string()).optional(),
  branchIds: z.array(z.string()).optional(),
  memoryIds: z.array(z.string()).optional(),
  coverMediaId: z.string().optional(),
  recurrence: z.union([z.nativeEnum(RecurrenceFrequency), z.string(), z.record(z.string(), z.unknown())]).optional(),
  reminderSettings: z
    .object({
      enabled: z.boolean().optional(),
      daysBefore: z.array(z.number()).optional(),
      notifyChannels: z.array(z.string()).optional(),
      customMessage: z.string().max(500).optional(),
    })
    .optional(),
  importance: z.nativeEnum(MilestoneImportance).or(z.string()).optional(),
  notes: z.string().max(5000).optional(),
  visibility: z.nativeEnum(EventVisibility).optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  eventType: z.nativeEnum(EventType).optional(),
  eventDate: z.string().nullable().optional(),
  approximateDate: z.string().max(100).optional(),
  era: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  memberIds: z.array(z.string()).optional(),
  branchIds: z.array(z.string()).optional(),
  memoryIds: z.array(z.string()).optional(),
  coverMediaId: z.string().nullable().optional(),
  recurrence: z.union([z.nativeEnum(RecurrenceFrequency), z.string(), z.record(z.string(), z.unknown())]).optional(),
  reminderSettings: z
    .object({
      enabled: z.boolean().optional(),
      daysBefore: z.array(z.number()).optional(),
      notifyChannels: z.array(z.string()).optional(),
      customMessage: z.string().max(500).optional(),
    })
    .optional(),
  importance: z.nativeEnum(MilestoneImportance).or(z.string()).optional(),
  notes: z.string().max(5000).optional(),
  visibility: z.nativeEnum(EventVisibility).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

