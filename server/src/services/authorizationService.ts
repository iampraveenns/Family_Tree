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
   * Respects Role Hierarchy, Branch Scopes, and verified Descendant Traversal.
   */
  async canManageMember(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    targetMemberId: string | Types.ObjectId,
    permission: Permission
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'No active membership in this family' };
    }

    // Check base permission for the role
    const roleHasPerm =
      hasPermission(membership.role, permission) ||
      (membership.permissions && membership.permissions.includes(permission));

    if (!roleHasPerm) {
      return {
        allowed: false,
        reason: `Role ${membership.role} does not possess ${permission} permission`,
      };
    }

    // FAMILY_OWNER and FAMILY_ADMIN have family-wide management scope
    if (membership.role === Role.FAMILY_OWNER || membership.role === Role.FAMILY_ADMIN) {
      return { allowed: true };
    }

    // VIEWERS cannot perform write/delete operations
    if (membership.role === Role.VIEWER) {
      if (permission === Permission.VIEW_MEMBER) return { allowed: true };
      return { allowed: false, reason: 'Viewers have read-only access' };
    }

    const targetStr = targetMemberId.toString();
    const userLinkedMemberStr = membership.memberId ? membership.memberId.toString() : null;

    // Self-management: Members and Managers can edit their own member profile
    const isSelf = userLinkedMemberStr !== null && userLinkedMemberStr === targetStr;
    if (isSelf) {
      // Self cannot delete self
      if (permission === Permission.DELETE_MEMBER) {
        return { allowed: false, reason: 'Members cannot delete their own profile' };
      }
      return { allowed: true };
    }

    // Standard MEMBER: Can only edit self
    if (membership.role === Role.MEMBER) {
      if (permission === Permission.VIEW_MEMBER) return { allowed: true };
      return { allowed: false, reason: 'Standard members can only modify their own profile' };
    }

    // PARENT_MANAGER: Can manage self and verified descendants
    if (membership.role === Role.PARENT_MANAGER) {
      if (!userLinkedMemberStr) {
        return {
          allowed: false,
          reason: 'Parent manager must have a linked family member to manage descendants',
        };
      }

      const descendants = await this.getDescendantMemberIds(familyId, userLinkedMemberStr);
      if (descendants.has(targetStr)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Parent managers can only manage themselves and their verified descendants',
      };
    }

    // BRANCH_MANAGER: Can manage members within their assigned branch
    if (membership.role === Role.BRANCH_MANAGER) {
      const targetMember = await memberRepository.findById(targetMemberId);
      if (!targetMember) {
        return { allowed: false, reason: 'Target member not found' };
      }

      if (!membership.branchId) {
        return { allowed: false, reason: 'Branch manager has no assigned branch' };
      }

      const assignedBranchStr = membership.branchId.toString();
      const memberBranches = (targetMember.branchIds || []).map((b) => b.toString());

      if (memberBranches.includes(assignedBranchStr)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Branch managers can only manage members in their assigned branch',
      };
    }

    return { allowed: false, reason: 'Insufficient authority for target member' };
  }

  /**
   * Evaluates authorization to create a new member with an associated parent relationship.
   * Enforces that Parent Managers only attach children to themselves or their descendants.
   */
  async canCreateMemberWithRelationship(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    parentId?: string | Types.ObjectId,
    branchId?: string | Types.ObjectId
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'No active membership in this family' };
    }

    if (membership.role === Role.FAMILY_OWNER || membership.role === Role.FAMILY_ADMIN) {
      return { allowed: true };
    }

    if (membership.role === Role.VIEWER || membership.role === Role.CONTRIBUTOR) {
      return { allowed: false, reason: 'Role does not permit member creation' };
    }

    // PARENT_MANAGER creating a child:
    if (membership.role === Role.PARENT_MANAGER) {
      if (!parentId) {
        return {
          allowed: false,
          reason: 'Parent managers must specify an authorized parent when creating a member',
        };
      }

      const userLinkedMemberStr = membership.memberId ? membership.memberId.toString() : null;
      if (!userLinkedMemberStr) {
        return {
          allowed: false,
          reason: 'Parent manager is not linked to a family member node',
        };
      }

      const parentStr = parentId.toString();
      if (parentStr === userLinkedMemberStr) {
        // Adding child to self
        return { allowed: true };
      }

      // Or adding child to a descendant (e.g. grandchild)
      const descendants = await this.getDescendantMemberIds(familyId, userLinkedMemberStr);
      if (descendants.has(parentStr)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Parent managers can only add children to themselves or their descendants',
      };
    }

    // BRANCH_MANAGER:
    if (membership.role === Role.BRANCH_MANAGER) {
      if (branchId && membership.branchId && branchId.toString() === membership.branchId.toString()) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Branch managers can only create members in their assigned branch',
      };
    }

    return { allowed: false, reason: 'Insufficient authority to create member' };
  }

  /**
   * Evaluates authorization for relationship creation between two members.
   */
  async canManageRelationship(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    sourceMemberId: string | Types.ObjectId,
    targetMemberId: string | Types.ObjectId,
    relationshipType: RelationshipType
  ): Promise<AuthorizationResult> {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'No active membership in this family' };
    }

    if (membership.role === Role.FAMILY_OWNER || membership.role === Role.FAMILY_ADMIN) {
      return { allowed: true };
    }

    if (membership.role === Role.VIEWER || membership.role === Role.CONTRIBUTOR) {
      return { allowed: false, reason: 'Role does not permit managing relationships' };
    }

    const userLinkedMemberStr = membership.memberId ? membership.memberId.toString() : null;
    if (!userLinkedMemberStr) {
      return { allowed: false, reason: 'User must be linked to a member node' };
    }

    const sourceStr = sourceMemberId.toString();
    const targetStr = targetMemberId.toString();

    // PARENT_MANAGER:
    if (membership.role === Role.PARENT_MANAGER) {
      const descendants = await this.getDescendantMemberIds(familyId, userLinkedMemberStr);

      if (relationshipType === RelationshipType.PARENT) {
        // source is parent, target is child
        // Allowed if parent is self or descendant
        const isParentSelfOrDescendant = sourceStr === userLinkedMemberStr || descendants.has(sourceStr);
        if (isParentSelfOrDescendant) {
          return { allowed: true };
        }
      }

      if (relationshipType === RelationshipType.CHILD) {
        // target is parent, source is child
        const isParentSelfOrDescendant = targetStr === userLinkedMemberStr || descendants.has(targetStr);
        if (isParentSelfOrDescendant) {
          return { allowed: true };
        }
      }

      if (relationshipType === RelationshipType.SPOUSE) {
        // Can add spouse to self or to a descendant
        if (sourceStr === userLinkedMemberStr || targetStr === userLinkedMemberStr) {
          return { allowed: true };
        }
        if (descendants.has(sourceStr) || descendants.has(targetStr)) {
          return { allowed: true };
        }
      }

      return {
        allowed: false,
        reason: 'Parent managers cannot manage relationships between unrelated family members',
      };
    }

    return { allowed: false, reason: 'Insufficient authority to manage relationships' };
  }

  /**
   * Evaluates role changes, enforcing the Role Hierarchy and Family Owner protections:
   * 1. Self-escalation prevention (user cannot change own role)
   * 2. Cannot demote or remove the final FAMILY_OWNER
   * 3. Cannot promote someone to equal/higher rank than actor's own role
   * 4. Cannot modify a user who holds equal/higher rank than actor
   * 5. Only FAMILY_OWNER can appoint another FAMILY_OWNER
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

    // Rule 1: Cannot change own role (prevent self-escalation)
    if (actorMembership.userId.toString() === targetMembership.userId.toString()) {
      return { allowed: false, reason: 'Users are strictly prohibited from modifying their own role' };
    }

    // Rule 2: Must have MANAGE_ROLES permission
    const hasManageRoles =
      hasPermission(actorMembership.role, Permission.MANAGE_ROLES) ||
      (actorMembership.permissions && actorMembership.permissions.includes(Permission.MANAGE_ROLES));

    if (!hasManageRoles) {
      return { allowed: false, reason: 'Actor lacks MANAGE_ROLES permission' };
    }

    // Rule 3: Protection for final FAMILY_OWNER
    if (targetMembership.role === Role.FAMILY_OWNER && newRole !== Role.FAMILY_OWNER) {
      const ownerCount = await membershipRepository.countOwners(familyId);
      if (ownerCount <= 1) {
        return {
          allowed: false,
          reason: 'Cannot demote the final FAMILY_OWNER. Appoint another owner first.',
        };
      }
    }

    // FAMILY_OWNER can assign any role
    if (actorMembership.role === Role.FAMILY_OWNER) {
      return { allowed: true };
    }

    // For non-owners:
    const actorRank = RoleRank[actorMembership.role] || 0;
    const targetCurrentRank = RoleRank[targetMembership.role] || 0;
    const requestedRank = RoleRank[newRole] || 0;

    // Rule 4: Cannot modify a member whose current rank is equal to or higher than actor
    if (targetCurrentRank >= actorRank) {
      return {
        allowed: false,
        reason: `Cannot modify members with equal or higher role rank (${targetMembership.role})`,
      };
    }

    // Rule 5: Cannot promote someone to equal or higher rank than actor
    if (requestedRank >= actorRank) {
      return {
        allowed: false,
        reason: `Cannot grant a role (${newRole}) equal to or higher than actor's role (${actorMembership.role})`,
      };
    }

    // Rule 6: Only FAMILY_OWNER can appoint another FAMILY_OWNER
    if (newRole === Role.FAMILY_OWNER) {
      return { allowed: false, reason: 'Only the Family Owner can appoint another Family Owner' };
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

    // Archived memories are only visible to Owners, Admins, and Creator
    if (memory.status === MemoryStatus.ARCHIVED) {
      const isPrivileged =
        membership.role === Role.FAMILY_OWNER ||
        membership.role === Role.FAMILY_ADMIN ||
        memory.createdBy.toString() === actorUserId.toString();
      return {
        allowed: isPrivileged,
        reason: isPrivileged ? undefined : 'Archived memories are restricted to family administrators and creators',
      };
    }

    // Family Owners and Admins have global family visibility
    if (membership.role === Role.FAMILY_OWNER || membership.role === Role.FAMILY_ADMIN) {
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

    // Owners and Admins have full management authority
    if (membership.role === Role.FAMILY_OWNER || membership.role === Role.FAMILY_ADMIN) {
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

    // FAMILY_OWNER and FAMILY_ADMIN have full branch authority
    if (actorMembership.role === Role.FAMILY_OWNER || actorMembership.role === Role.FAMILY_ADMIN) {
      return { allowed: true };
    }

    // Creating or deleting branches is restricted to Family Owners and Admins
    if (action === 'CREATE' || action === 'DELETE') {
      return { allowed: false, reason: 'Only Family Owners or Admins can create or delete branches' };
    }

    // BRANCH_MANAGER can update/archive/assign for their own branch
    if (actorMembership.role === Role.BRANCH_MANAGER && branchId) {
      const targetBranchStr = branchId.toString();
      // Check actor's membership branchId
      if (actorMembership.branchId && actorMembership.branchId.toString() === targetBranchStr) {
        return { allowed: true };
      }

      // Or check if actor is in branch's managerIds
      const { Branch } = await import('../models/Branch.ts');
      const branch = await Branch.findOne({ _id: branchId, familyId });
      if (branch && branch.managerIds.some((m) => m.toString() === actorUserId.toString())) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Branch managers can only manage their own designated branch',
      };
    }

    return { allowed: false, reason: 'Actor lacks MANAGE_BRANCH permission' };
  }

  /**
   * Evaluates if actor can safely transfer a member between branches.
   */
  async canTransferMember(
    actorUserId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    memberId: string | Types.ObjectId,
    fromBranchId?: string | Types.ObjectId,
    targetBranchId?: string | Types.ObjectId
  ): Promise<AuthorizationResult> {
    const actorMembership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      return { allowed: false, reason: 'Active family membership is required' };
    }

    if (actorMembership.role === Role.FAMILY_OWNER || actorMembership.role === Role.FAMILY_ADMIN) {
      return { allowed: true };
    }

    // Branch managers can only transfer members if they manage both source and destination branch
    if (actorMembership.role === Role.BRANCH_MANAGER) {
      const actorBranchStr = actorMembership.branchId ? actorMembership.branchId.toString() : '';
      const targetStr = targetBranchId ? targetBranchId.toString() : '';
      const fromStr = fromBranchId ? fromBranchId.toString() : '';

      if (actorBranchStr && actorBranchStr === targetStr && (!fromStr || actorBranchStr === fromStr)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Branch managers cannot transfer members outside their branch scope',
      };
    }

    return { allowed: false, reason: 'Actor lacks permission to transfer members between branches' };
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

    const role = membership.role;
    const permissions = membership.permissions?.length
      ? membership.permissions
      : DEFAULT_ROLE_PERMISSIONS[role] || [];

    const whatYouCanDo: string[] = [];
    const whatYouCannotDo: string[] = [];

    if (role === Role.FAMILY_OWNER) {
      whatYouCanDo.push(
        'Full administrative authority across all family members, branches, and vault memories',
        'Appoint or demote any role including Family Owners and Family Admins',
        'Invite new members and revoke or resend outstanding invitations',
        'Create, rename, archive, or delete any branch',
        'Access the full immutable audit and activity log',
        'Delete the family vault or export heritage archives'
      );
    } else if (role === Role.FAMILY_ADMIN) {
      whatYouCanDo.push(
        'Manage members, relationships, and all branch structures',
        'Invite relatives as Branch Managers, Parent Managers, Contributors, or Viewers',
        'Create, archive, and assign managers to branches',
        'Review activity and audit logs',
        'Manage all memories, stories, and media assets'
      );
      whatYouCannotDo.push(
        'Cannot appoint other Family Owners or demote existing Family Owners',
        'Cannot modify or suspend fellow Family Admins',
        'Cannot delete the primary family vault'
      );
    } else if (role === Role.BRANCH_MANAGER) {
      whatYouCanDo.push(
        `Manage records and relationships within your designated branch (${branch?.name || 'Assigned Branch'})`,
        'Upload and curate branch memories and stories',
        'Invite new relatives into your branch scope',
        'Update branch information and settings'
      );
      whatYouCannotDo.push(
        'Cannot modify members or memories in other family branches',
        'Cannot assign or modify administrative roles',
        'Cannot delete or create other family branches',
        'Cannot view restricted private memories outside your branch'
      );
    } else if (role === Role.PARENT_MANAGER) {
      whatYouCanDo.push(
        'Manage records, profile details, and relationships strictly for your direct descendants',
        'Upload memories featuring your descendants and immediate family',
        'Tag descendants in photos and stories'
      );
      whatYouCannotDo.push(
        'Cannot edit records of ancestors, siblings, or collateral cousins',
        'Cannot manage branch configurations or role assignments',
        'Cannot send administrative invitations'
      );
    } else if (role === Role.CONTRIBUTOR) {
      whatYouCanDo.push(
        'Upload photos, stories, audio, documents, and recipes',
        'Suggest corrections and additions to family members',
        'Participate in family discussions and milestones'
      );
      whatYouCannotDo.push(
        'Cannot modify member relationships or core identity attributes directly',
        'Cannot manage branch structures or user permissions',
        'Cannot suspend other members or manage invitations'
      );
    } else {
      whatYouCanDo.push(
        'Browse the interactive family tree and generation timeline',
        'View shared stories, photos, audio, documents, and recipes',
        'Explore genealogy kinship paths'
      );
      whatYouCannotDo.push(
        'Cannot modify tree members or kinship edges',
        'Cannot upload or delete memories',
        'Cannot manage branch or administrative settings'
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
        isFamilyWide: [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(role),
        branchScope: role === Role.BRANCH_MANAGER ? branch?.name || 'Assigned Branch' : null,
        parentScope: role === Role.PARENT_MANAGER ? 'Descendants only' : null,
      },
      capabilities: {
        canInviteMembers: hasPermission(role, Permission.INVITE_MEMBER),
        canManageRoles: hasPermission(role, Permission.MANAGE_ROLES),
        canManageBranches: hasPermission(role, Permission.MANAGE_BRANCH),
        canCreateMemories: hasPermission(role, Permission.UPLOAD_MEMORY),
        canEditAllMembers: [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(role),
        canViewAuditLogs: [Role.FAMILY_OWNER, Role.FAMILY_ADMIN].includes(role),
      },
      whatYouCanDo,
      whatYouCannotDo,
      allowedActions: whatYouCanDo,
      prohibitedActions: whatYouCannotDo,
    };
  }
}

export const authorizationService = new AuthorizationService();
