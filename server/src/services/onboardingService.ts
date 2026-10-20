import crypto from 'crypto';
import { Types } from 'mongoose';
import { Family, IFamily } from '../models/Family.ts';
import { FamilyMember, IFamilyMember } from '../models/FamilyMember.ts';
import { Relationship, IRelationship } from '../models/Relationship.ts';
import { Branch, IBranch } from '../models/Branch.ts';
import { Memory, IMemory } from '../models/Memory.ts';
import { FamilyInvitation } from '../models/FamilyInvitation.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';
import { auditService } from './auditService.ts';
import { AuditAction, Role, RelationshipType, RelationshipStatus, MemoryType, MemoryVisibility, MemoryStatus, InvitationStatus, DEFAULT_ROLE_PERMISSIONS } from '../constants/index.ts';
import { ValidationError } from '../utils/errors.ts';

export interface OnboardingImmediateMemberInput {
  relation: 'SPOUSE' | 'CHILD' | 'PARENT';
  firstName: string;
  lastName: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  dateOfBirth?: string;
  profilePhoto?: string;
}

export interface OnboardingMemoryInput {
  title: string;
  memoryType?: 'PHOTO' | 'STORY' | 'AUDIO' | 'DOCUMENT' | 'RECIPE';
  description?: string;
  eventDate?: string;
  location?: string;
  tags?: string[];
  mediaUrl?: string;
}

export interface OnboardingInvitationInput {
  email: string;
  role?: string;
}

export interface OnboardingPayload {
  family: {
    name: string;
    originPlace?: string;
    description?: string;
    motto?: string;
    coverImage?: string;
  };
  rootAncestor: {
    firstName: string;
    lastName: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    dateOfBirth?: string;
    birthPlace?: string;
    occupation?: string;
    biography?: string;
    profilePhoto?: string;
  };
  immediateFamily?: OnboardingImmediateMemberInput[];
  firstMemory?: OnboardingMemoryInput;
  invitations?: OnboardingInvitationInput[];
}

export interface OnboardingSummaryResult {
  family: IFamily;
  rootAncestor: IFamilyMember;
  branch: IBranch;
  members: IFamilyMember[];
  relationships: IRelationship[];
  memories: IMemory[];
  invitationsCount: number;
  generationsCount: number;
  completionProgress: number;
}

export class OnboardingService {
  async setupFamilyVault(
    payload: OnboardingPayload,
    context?: { userId?: string }
  ): Promise<OnboardingSummaryResult> {
    if (!payload.family?.name?.trim()) {
      throw new ValidationError('Family name is required to initialize vault');
    }
    if (!payload.rootAncestor?.firstName?.trim() || !payload.rootAncestor?.lastName?.trim()) {
      throw new ValidationError('Root ancestor first and last name are required');
    }

    const creatorId = context?.userId && Types.ObjectId.isValid(context.userId)
      ? new Types.ObjectId(context.userId)
      : new Types.ObjectId();

    // 1. Create the Family
    const family = await Family.create({
      name: payload.family.name.trim(),
      description: payload.family.description?.trim() || 'A living archive preserving family lineages, treasured memories, and heritage across generations.',
      originPlace: payload.family.originPlace?.trim() || '',
      motto: payload.family.motto?.trim() || 'Connected by Roots, Thriving in Branches',
      coverImage: payload.family.coverImage || '',
      createdBy: creatorId,
      settings: {
        defaultMemberVisibility: 'FAMILY',
        allowMemberInvitations: true,
        allowPublicProfiles: false,
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
      },
    });

    // 2. Determine generational positioning
    const immediate = payload.immediateFamily || [];
    const hasParent = immediate.some((m) => m.relation === 'PARENT');
    const rootGeneration = hasParent ? 2 : 1;

    // 3. Create Root Branch
    const branchName = `${payload.rootAncestor.lastName.trim()} Lineage`;
    const branch = await Branch.create({
      familyId: family._id,
      name: branchName,
      description: `Foundational ancestral line established through ${payload.rootAncestor.firstName} ${payload.rootAncestor.lastName}.`,
      rootMemberId: new Types.ObjectId(), // updated shortly
      accentColor: '#0F8F72', // Emerald
      createdBy: creatorId,
    });

    // 4. Create Root Ancestor
    const rootMember = await FamilyMember.create({
      familyId: family._id,
      firstName: payload.rootAncestor.firstName.trim(),
      lastName: payload.rootAncestor.lastName.trim(),
      displayName: `${payload.rootAncestor.firstName.trim()} ${payload.rootAncestor.lastName.trim()}`,
      gender: payload.rootAncestor.gender || 'UNKNOWN',
      dateOfBirth: payload.rootAncestor.dateOfBirth?.trim() || '',
      isLiving: true,
      birthPlace: payload.rootAncestor.birthPlace?.trim() || payload.family.originPlace?.trim() || '',
      occupation: payload.rootAncestor.occupation?.trim() || '',
      biography: payload.rootAncestor.biography?.trim() || '',
      profilePhoto: payload.rootAncestor.profilePhoto || '',
      generation: rootGeneration,
      branchIds: [branch._id],
      createdBy: creatorId,
    });

    // Update branch rootMemberId
    branch.rootMemberId = rootMember._id;
    await branch.save();

    const allMembers: IFamilyMember[] = [rootMember];
    const allRelationships: IRelationship[] = [];
    const spouseMembers: IFamilyMember[] = [];

    // 5. Create Immediate Relatives and Relationships
    for (const item of immediate) {
      if (!item.firstName?.trim() || !item.lastName?.trim()) continue;

      let memberGen = rootGeneration;
      if (item.relation === 'PARENT') memberGen = rootGeneration - 1;
      if (item.relation === 'CHILD') memberGen = rootGeneration + 1;

      const member = await FamilyMember.create({
        familyId: family._id,
        firstName: item.firstName.trim(),
        lastName: item.lastName.trim(),
        displayName: `${item.firstName.trim()} ${item.lastName.trim()}`,
        gender: item.gender || 'UNKNOWN',
        dateOfBirth: item.dateOfBirth?.trim() || '',
        isLiving: true,
        profilePhoto: item.profilePhoto || '',
        generation: memberGen,
        branchIds: [branch._id],
        createdBy: creatorId,
      });

      allMembers.push(member);

      if (item.relation === 'SPOUSE') {
        spouseMembers.push(member);
        const rel = await Relationship.create({
          familyId: family._id,
          sourceMemberId: rootMember._id,
          targetMemberId: member._id,
          relationshipType: RelationshipType.SPOUSE,
          status: RelationshipStatus.ACTIVE,
          createdBy: creatorId,
        });
        allRelationships.push(rel);
      } else if (item.relation === 'PARENT') {
        const rel = await Relationship.create({
          familyId: family._id,
          sourceMemberId: member._id,
          targetMemberId: rootMember._id,
          relationshipType: RelationshipType.PARENT,
          status: RelationshipStatus.ACTIVE,
          createdBy: creatorId,
        });
        allRelationships.push(rel);
      } else if (item.relation === 'CHILD') {
        // Link root as parent
        const rel1 = await Relationship.create({
          familyId: family._id,
          sourceMemberId: rootMember._id,
          targetMemberId: member._id,
          relationshipType: RelationshipType.PARENT,
          status: RelationshipStatus.ACTIVE,
          createdBy: creatorId,
        });
        allRelationships.push(rel1);

        // Also link spouse as parent if one exists
        for (const spouse of spouseMembers) {
          const rel2 = await Relationship.create({
            familyId: family._id,
            sourceMemberId: spouse._id,
            targetMemberId: member._id,
            relationshipType: RelationshipType.PARENT,
            status: RelationshipStatus.ACTIVE,
            createdBy: creatorId,
          });
          allRelationships.push(rel2);
        }
      }
    }

    // 6. Create First Memory if provided
    const createdMemories: IMemory[] = [];
    if (payload.firstMemory && payload.firstMemory.title?.trim()) {
      const memoryTypeStr = payload.firstMemory.memoryType || 'PHOTO';
      const parsedType = Object.values(MemoryType).includes(memoryTypeStr as MemoryType)
        ? (memoryTypeStr as MemoryType)
        : MemoryType.PHOTO;

      const memory = await Memory.create({
        familyId: family._id,
        title: payload.firstMemory.title.trim(),
        description: payload.firstMemory.description?.trim() || '',
        memoryType: parsedType,
        createdBy: creatorId,
        eventDate: payload.firstMemory.eventDate ? new Date(payload.firstMemory.eventDate) : undefined,
        location: payload.firstMemory.location?.trim() || family.originPlace || '',
        visibility: MemoryVisibility.FAMILY,
        memberIds: allMembers.map((m) => m._id),
        branchIds: [branch._id],
        tags: payload.firstMemory.tags && payload.firstMemory.tags.length > 0
          ? payload.firstMemory.tags
          : ['Foundational', 'Heritage', family.name],
        status: MemoryStatus.ACTIVE,
      });
      createdMemories.push(memory);
    }

    // 7. Process Invitations
    let invitationsCount = 0;
    if (payload.invitations && payload.invitations.length > 0) {
      for (const inv of payload.invitations) {
        if (!inv.email || !inv.email.includes('@')) continue;
        const normalizedEmail = inv.email.toLowerCase().trim();
        const role = (Object.values(Role).includes(inv.role as Role) ? inv.role : Role.CONTRIBUTOR) as Role;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await FamilyInvitation.create({
          familyId: family._id,
          invitedEmail: normalizedEmail,
          invitedBy: creatorId,
          role,
          tokenHash,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          status: InvitationStatus.PENDING,
        });
        invitationsCount++;
      }
    }

    // 8. Create Family Membership for creator if user exists
    if (context?.userId && Types.ObjectId.isValid(context.userId)) {
      await FamilyMembership.create({
        userId: creatorId,
        familyId: family._id,
        memberId: rootMember._id,
        role: Role.FAMILY_OWNER,
        status: 'ACTIVE',
        permissions: DEFAULT_ROLE_PERMISSIONS[Role.FAMILY_OWNER],
      });
    }

    // 9. Audit Log
    await auditService.log(
      family._id,
      context?.userId || 'system',
      AuditAction.FAMILY_UPDATED,
      'Family',
      family._id.toString(),
      {
        action: 'ONBOARDING_COMPLETED',
        totalMembers: allMembers.length,
        totalRelationships: allRelationships.length,
        totalMemories: createdMemories.length,
        totalInvitations: invitationsCount,
      }
    );

    // 10. Calculate Generations Count
    const generationsSet = new Set(allMembers.map((m) => m.generation));
    const generationsCount = Math.max(generationsSet.size, 1);

    return {
      family,
      rootAncestor: rootMember,
      branch,
      members: allMembers,
      relationships: allRelationships,
      memories: createdMemories,
      invitationsCount,
      generationsCount,
      completionProgress: 100,
    };
  }
}

export const onboardingService = new OnboardingService();
