import { Types } from 'mongoose';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { Relationship } from '../models/Relationship.ts';
import {
  Role,
  RoleRank,
  Permission,
  DEFAULT_ROLE_PERMISSIONS,
  RelationshipType,
  MemoryVisibility,
  MemoryStatus,
  hasPermission,
  normalizeRole,
} from '../constants/index.ts';
import { IMemory } from '../models/Memory.ts';
import { ForbiddenError } from '../utils/errors.ts';

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export class AuthorizationService {
  /**
   * Computes all descendant member IDs for a given root member by traversing PARENT/CHILD relationships via BFS.
   * Traversal includes children, grandchildren, great-grandchildren, etc.
   * Ancestors, siblings, and collateral relatives (cousins, aunts/uncles) are excluded.
   */
  async getDescendantMemberIds(
    familyId: string | Types.ObjectId,
    rootMemberId: string | Types.ObjectId
  ): Promise<Set<string>> {
    const descendants = new Set<string>();
    const rootStr = rootMemberId.toString();
    const queue: string[] = [rootStr];
    const visited = new Set<string>([rootStr]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Find children of `current`:
      // Case 1: source=current, type=PARENT -> target is the child
      // Case 2: target=current, type=CHILD -> source is the child
      const childRelationships = await Relationship.find({
        familyId,
        $or: [
          { sourceMemberId: current, relationshipType: RelationshipType.PARENT },
          { targetMemberId: current, relationshipType: RelationshipType.CHILD },
        ],
      }).lean();

      for (const rel of childRelationships) {
        const childId =
          rel.relationshipType === RelationshipType.PARENT
            ? rel.targetMemberId.toString()
            : rel.sourceMemberId.toString();

        if (!visited.has(childId)) {
          visited.add(childId);
          descendants.add(childId);
          queue.push(childId);
        }
      }
    }

    return descendants;
  }

  async canViewMember(
    userId: string | Types.ObjectId,
    member: { familyId: string | Types.ObjectId; _id: string | Types.ObjectId }
  ): Promise<AuthorizationResult> {
    return this.canManageMember(userId, member.familyId, member._id, Permission.VIEW_MEMBER);
  }

  /**
   * Evaluates resource-scoped permission to view, edit, or delete a specific member.
   * Strictly enforces 2-role model: ADMIN has full management authority;
   * VIEWER has strictly read-only access to tree members.
   */
  async canManageMember(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    _targetMemberId: string | Types.ObjectId,
    permission: Permission
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'No active membership in this family' };
    }

    const effectiveRole = normalizeRole(membership.role);

    // ADMIN has family-wide tree member management scope
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    // Secure Self-Profile Editing (JWT / Account-to-Node Matching)
    // Allow users to edit only their own profile once a match is confirmed between account and node
    if (permission === Permission.EDIT_MEMBER) {
      let isMatch = false;
      if (membership.memberId && membership.memberId.toString() === _targetMemberId.toString()) {
        isMatch = true;
      } else {
        const targetMember = Types.ObjectId.isValid(_targetMemberId.toString())
          ? await memberRepository.findById(_targetMemberId.toString())
          : null;
        if (targetMember && targetMember.linkedUserId && targetMember.linkedUserId.toString() === userId.toString()) {
          isMatch = true;
        }
      }
      if (isMatch) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'You are only authorized to edit your own profile node in the family tree' };
    }

    // VIEWER is strictly read-only for all other tree member operations (add, delete)
    if (effectiveRole === Role.VIEWER) {
      if (permission === Permission.VIEW_MEMBER) return { allowed: true };
      return { allowed: false, reason: 'Viewers have read-only access to tree members' };
    }

    // Fallback permission check
    const roleHasPerm =
      hasPermission(effectiveRole, permission) ||
      (membership.permissions && membership.permissions.includes(permission));

    if (!roleHasPerm) {
      return {
        allowed: false,
        reason: `Role ${membership.role} does not possess ${permission} permission`,
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluates authorization to create a new member with an associated parent relationship.
   * Only ADMIN can create family tree members.
   */
  async canCreateMemberWithRelationship(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    _parentId?: string | Types.ObjectId,
    _branchId?: string | Types.ObjectId
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'No active membership in this family' };
    }

    const effectiveRole = normalizeRole(membership.role);
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Role does not permit member creation' };
  }

  /**
   * Evaluates authorization for relationship creation between two members.
   */
  async canManageRelationship(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    _sourceMemberId: string | Types.ObjectId,
    _targetMemberId: string | Types.ObjectId,
    _relationshipType: RelationshipType
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'No active membership in this family' };
    }

    const effectiveRole = normalizeRole(membership.role);
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Role does not permit managing relationships' };
  }

  /**
   * Evaluates role changes, enforcing the Single Admin Constraint:
   * 1. A family can have strictly ONE ADMIN (the creator or explicitly transferred to another user).
   * 2. Only the current ADMIN can modify roles.
   * 3. Cannot change own role directly (ownership transfer must target another member).
   * 4. Promoting another user to ADMIN is an ownership transfer (transfers sole ADMIN to that user).
   */
  async canModifyMembershipRole(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    targetMembershipId: string | Types.ObjectId,
    newRole: Role
  ): Promise<AuthorizationResult> {
    const actorMembership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Actor does not have active membership in this family' };
    }

    const targetMembership = await membershipRepository.findById(targetMembershipId);
    if (!targetMembership || targetMembership.familyId.toString() !== familyId.toString()) {
      return { allowed: false, reason: 'Target membership not found in this family' };
    }

    // Rule 1: Cannot change own role directly
    if (actorMembership.userId.toString() === targetMembership.userId.toString()) {
      return { allowed: false, reason: 'Users are strictly prohibited from modifying their own role' };
    }

    const actorEffectiveRole = normalizeRole(actorMembership.role);
    if (actorEffectiveRole !== Role.ADMIN) {
      return { allowed: false, reason: 'Only the Family ADMIN can manage roles' };
    }

    const targetCurrentRole = normalizeRole(targetMembership.role);
    const requestedRole = normalizeRole(newRole);

    // If target is currently ADMIN and actor attempts to demote them without transfer
    if (targetCurrentRole === Role.ADMIN && requestedRole !== Role.ADMIN) {
      const adminCount = await membershipRepository.countAdmins(familyId);
      if (adminCount <= 1) {
        return {
          allowed: false,
          reason: 'Cannot demote the sole ADMIN. Transfer ownership to another user first.',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Evaluates if user can upload/create memories in a family space.
   */
  async canCreateMemory(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required to create memories' };
    }

    const canUpload =
      hasPermission(membership.role, Permission.UPLOAD_MEMORY) ||
      (membership.permissions && membership.permissions.includes(Permission.UPLOAD_MEMORY));

    if (!canUpload) {
      return { allowed: false, reason: 'Actor lacks UPLOAD_MEMORY permission' };
    }

    return { allowed: true };
  }

  /**
   * Evaluates if user can view a specific memory based on visibility & branch scopes.
   */
  async canViewMemory(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    memory: IMemory
  ): Promise<AuthorizationResult> {
    // Cross-family protection: strictly prevent IDOR
    if (memory.familyId.toString() !== familyId.toString()) {
      return { allowed: false, reason: 'Access denied: Memory belongs to an unrelated family space' };
    }

    if (memory.visibility === MemoryVisibility.PUBLIC) {
      return { allowed: true };
    }

    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required to view family heritage memories' };
    }

    const effectiveRole = normalizeRole(membership.role);

    // Archived memories are only visible to Admins and Creator
    if (memory.status === MemoryStatus.ARCHIVED) {
      const isPrivileged =
        effectiveRole === Role.ADMIN ||
        memory.createdBy.toString() === actorUserId.toString();
      return {
        allowed: isPrivileged,
        reason: isPrivileged ? undefined : 'Archived memories are restricted to family administrators and creators',
      };
    }

    // Family Admins have global family visibility
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    // Private memories only viewable by creator
    if (memory.visibility === MemoryVisibility.PRIVATE) {
      const isCreator = memory.createdBy.toString() === actorUserId.toString();
      return {
        allowed: isCreator,
        reason: isCreator ? undefined : 'Private memories can only be accessed by their creator',
      };
    }

    // Branch visibility checks
    if (memory.visibility === MemoryVisibility.BRANCH) {
      const memoryBranchStrs = (memory.branchIds || []).map((b) => b.toString());
      if (memoryBranchStrs.length === 0) {
        return { allowed: true };
      }

      // Check membership branch or linked member branches
      const memberId = membership.memberId;
      if (memberId) {
        const member = await memberRepository.findById(memberId);
        if (member) {
          const userBranchStrs = (member.branchIds || []).map((b) => b.toString());
          const hasBranchMatch = userBranchStrs.some((b) => memoryBranchStrs.includes(b));
          if (hasBranchMatch) return { allowed: true };
        }
      }

      // Creator always has access
      if (memory.createdBy.toString() === actorUserId.toString()) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'This memory is restricted to specific branch lineage members',
      };
    }

    // Standard FAMILY visibility is viewable by all active members
    return { allowed: true };
  }

  /**
   * Evaluates if user can edit or delete a specific memory.
   */
  async canManageMemory(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    memory: IMemory,
    action: Permission.EDIT_MEMORY | Permission.DELETE_MEMORY
  ): Promise<AuthorizationResult> {
    if (memory.familyId.toString() !== familyId.toString()) {
      return { allowed: false, reason: 'Access denied: Memory belongs to another family space' };
    }

    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required' };
    }

    const effectiveRole = normalizeRole(membership.role);

    // Admins have full management authority
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    // Check base permission
    const hasPerm =
      hasPermission(membership.role, action) ||
      (membership.permissions && membership.permissions.includes(action));

    if (!hasPerm) {
      return { allowed: false, reason: `Actor lacks ${action} permission` };
    }

    // Creator can always edit or delete their own active memory
    if (memory.createdBy.toString() === actorUserId.toString()) {
      return { allowed: true };
    }

    // Branch managers can manage memories strictly within their branch
    if (membership.role === Role.BRANCH_MANAGER) {
      const memberId = membership.memberId;
      if (memberId) {
        const member = await memberRepository.findById(memberId);
        if (member) {
          const userBranchStrs = (member.branchIds || []).map((b) => b.toString());
          const memoryBranchStrs = (memory.branchIds || []).map((b) => b.toString());
          const hasBranchMatch = userBranchStrs.some((b) => memoryBranchStrs.includes(b));
          if (hasBranchMatch) return { allowed: true };
        }
      }
      return { allowed: false, reason: 'Branch managers can only manage memories within their branch' };
    }

    // Parent managers can manage memories if all tagged people are their verified descendants or self
    if (membership.role === Role.PARENT_MANAGER && membership.memberId) {
      const taggedMemberStrs = (memory.memberIds || []).map((m) => m.toString());
      if (taggedMemberStrs.length > 0) {
        const descendants = await this.getDescendantMemberIds(familyId, membership.memberId);
        descendants.add(membership.memberId.toString());
        const allTaggedAreDescendants = taggedMemberStrs.every((id) => descendants.has(id));
        if (allTaggedAreDescendants) {
          return { allowed: true };
        }
      }
      return {
        allowed: false,
        reason: 'Parent managers can only manage memories exclusively featuring their direct descendants',
      };
    }

    return { allowed: false, reason: 'Insufficient permissions to modify this memory' };
  }

  /**
   * Retrieves active family membership for the user.
   */
  async getMembership(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId
  ) {
    return membershipRepository.findByUserAndFamily(userId, familyId);
  }

  /**
   * Enforces that the actor has the required permission in the specified family space.
   * Throws ForbiddenError if unauthorized.
   */
  async requirePermission(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    permission: Permission
  ): Promise<void> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Active family membership is required');
    }

    const hasPerm =
      hasPermission(membership.role, permission) ||
      (membership.permissions && membership.permissions.includes(permission));

    if (!hasPerm) {
      throw new ForbiddenError(`Actor lacks ${permission} permission in this family`);
    }
  }

  /**
   * Evaluates if actor can suspend or reactivate another membership.
   */
  async canChangeMembershipStatus(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    targetMembershipId: string | Types.ObjectId,
    newStatus: 'ACTIVE' | 'SUSPENDED'
  ): Promise<AuthorizationResult> {
    const actorMembership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required' };
    }

    const canManage =
      hasPermission(actorMembership.role, Permission.MANAGE_ROLES) ||
      hasPermission(actorMembership.role, Permission.MANAGE_MEMBERS);
    if (!canManage) {
      return { allowed: false, reason: 'Actor lacks permission to change member status' };
    }

    const targetMembership = await membershipRepository.findById(targetMembershipId);
    if (!targetMembership || targetMembership.familyId.toString() !== familyId.toString()) {
      return { allowed: false, reason: 'Target membership does not exist in this family' };
    }

    // Protection 1: Cannot change own status
    if (actorMembership._id.toString() === targetMembership._id.toString()) {
      return { allowed: false, reason: 'Cannot suspend or reactivate your own membership' };
    }

    // Protection 2: Cannot suspend Family Owner
    if (targetMembership.role === Role.FAMILY_OWNER && newStatus === 'SUSPENDED') {
      return { allowed: false, reason: 'Cannot suspend a Family Owner' };
    }

    // Protection 3: Role rank hierarchy for non-owners
    if (actorMembership.role !== Role.FAMILY_OWNER) {
      const actorRank = RoleRank[actorMembership.role] || 0;
      const targetRank = RoleRank[targetMembership.role] || 0;

      if (targetRank >= actorRank) {
        return {
          allowed: false,
          reason: `Cannot modify status of members with equal or higher role rank (${targetMembership.role})`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Evaluates if actor can manage branches (create, rename, archive, assign managers).
   */
  async canManageBranch(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    branchId?: string | Types.ObjectId,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'ASSIGN_MANAGER' = 'UPDATE'
  ): Promise<AuthorizationResult> {
    const actorMembership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required' };
    }

    const effectiveRole = normalizeRole(actorMembership.role);
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Only the Family ADMIN can manage branches' };
  }

  /**
   * Evaluates if actor can safely transfer a member between branches.
   */
  async canTransferMember(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    _memberId: string | Types.ObjectId,
    _fromBranchId?: string | Types.ObjectId,
    _targetBranchId?: string | Types.ObjectId
  ): Promise<AuthorizationResult> {
    const actorMembership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required' };
    }

    const effectiveRole = normalizeRole(actorMembership.role);
    if (effectiveRole === Role.ADMIN) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Only the Family ADMIN can transfer members between branches' };
  }

  /**
   * Generates a transparent, detailed breakdown of what the current user can and cannot do.
   */
  async getUserPermissionsExplanation(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId
  ) {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership) {
      return null;
    }

    let linkedMember = null;
    if (membership.memberId) {
      const m = await memberRepository.findById(membership.memberId);
      if (m) {
        linkedMember = {
          id: m._id.toString(),
          name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
          profilePhoto: m.profilePhoto,
        };
      }
    }

    let branch = null;
    if (membership.branchId) {
      const { Branch } = await import('../models/Branch.ts');
      const b = await Branch.findById(membership.branchId);
      if (b) {
        branch = {
          id: b._id.toString(),
          name: b.name,
          color: b.accentColor,
        };
      }
    }

    const role = normalizeRole(membership.role);
    const permissions = membership.permissions?.length
      ? membership.permissions
      : DEFAULT_ROLE_PERMISSIONS[role] || [];

    const whatYouCanDo: string[] = [];
    const whatYouCannotDo: string[] = [];

    if (role === Role.ADMIN) {
      whatYouCanDo.push(
        'Full administrative authority across all family members, relationships, and branches',
        'Create, edit, and delete family tree member nodes (+ Add Relative, + Child, + Spouse, edit profile, delete member)',
        'Create, edit, and delete relationships and branch structures',
        'Upload, edit, and delete family memories and vault assets',
        'Manage family settings, invitations, exports, and backups'
      );
    } else {
      // VIEWER
      whatYouCanDo.push(
        'Browse the interactive family tree, search relatives, and filter branches',
        'Explore genealogy kinship paths, view member profiles, fit family, focus, fullscreen, and show map',
        'View shared stories, photos, audio, documents, and recipes in the family vault',
        'Upload new memories and stories to celebrate family heritage'
      );
      whatYouCannotDo.push(
        'Strictly read-only family tree: cannot add, edit, or delete member nodes',
        'Cannot create, edit, or delete family relationships or branches',
        'Cannot manage family settings, roles, or administrative exports'
      );
    }

    return {
      userId: userId.toString(),
      familyId: familyId.toString(),
      role,
      roleRank: RoleRank[role] || 0,
      status: membership.status,
      linkedMember,
      branch,
      permissions,
      scope: {
        isFamilyWide: role === Role.ADMIN,
        branchScope: null,
        parentScope: null,
      },
      capabilities: {
        canInviteMembers: hasPermission(role, Permission.INVITE_MEMBER),
        canManageRoles: hasPermission(role, Permission.MANAGE_ROLES),
        canManageBranches: hasPermission(role, Permission.MANAGE_BRANCH),
        canCreateMemories: hasPermission(role, Permission.UPLOAD_MEMORY),
        canEditAllMembers: role === Role.ADMIN,
        canViewAuditLogs: role === Role.ADMIN,
      },
      whatYouCanDo,
      whatYouCannotDo,
      allowedActions: whatYouCanDo,
      prohibitedActions: whatYouCannotDo,
    };
  }
}

export const authorizationService = new AuthorizationService();
