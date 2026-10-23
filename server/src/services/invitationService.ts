import { Types } from 'mongoose';
import { invitationRepository } from '../repositories/invitationRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { userRepository } from '../repositories/userRepository.ts';
import { familyRepository } from '../repositories/familyRepository.ts';
import { FamilyInvitation } from '../models/FamilyInvitation.ts';
import { auditService } from './auditService.ts';
import { notificationService } from './notificationService.ts';
import { SecurityUtils } from '../utils/security.ts';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.ts';
import {
  Role,
  Permission,
  InvitationStatus,
  AuditAction,
  hasPermission,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRole,
} from '../constants/index.ts';

export class InvitationService {
  /**
   * Generates a new family invitation.
   * Stores a SHA-256 hash in MongoDB and returns the raw token to the caller for sending.
   */
  async createInvitation(data: {
    familyId: string | Types.ObjectId;
    invitedEmail: string;
    role: Role;
    targetMemberId?: string | Types.ObjectId;
    branchId?: string | Types.ObjectId;
    invitedByUserId: string | Types.ObjectId;
  }) {
    const membership = await membershipRepository.findByUserAndFamily(
      data.invitedByUserId,
      data.familyId
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not an active member of this family');
    }

    const canInvite =
      hasPermission(membership.role, Permission.INVITE_MEMBER) ||
      (membership.permissions && membership.permissions.includes(Permission.INVITE_MEMBER));

    if (!canInvite) {
      throw new ForbiddenError('You do not have permission to invite new members');
    }

    const email = data.invitedEmail.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('A valid email address is required');
    }

    // Protection: Prevent inviting someone who already has active membership
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      const existingMembership = await membershipRepository.findByUserAndFamily(
        existingUser._id,
        data.familyId
      );
      if (existingMembership && existingMembership.status === 'ACTIVE') {
        throw new ConflictError(
          'A user with this email address is already an active member of this family'
        );
      }
    }

    // Protection: Prevent duplicate active pending invitations
    const pendingInvitation = await FamilyInvitation.findOne({
      familyId: new Types.ObjectId(data.familyId),
      invitedEmail: email,
      status: InvitationStatus.PENDING,
      expiresAt: { $gt: new Date() },
    });
    if (pendingInvitation) {
      throw new ConflictError(
        'A pending invitation for this email address already exists in this family. Please resend the existing invitation instead.'
      );
    }

    if (data.targetMemberId) {
      const member = await memberRepository.findById(data.targetMemberId);
      if (!member || member.familyId.toString() !== data.familyId.toString()) {
        throw new NotFoundError('Target member to link was not found in this family');
      }
    }

    const effectiveRole = data.role ? normalizeRole(data.role) : Role.VIEWER;
    if (effectiveRole === Role.ADMIN) {
      throw new ValidationError(
        'A family can have only one ADMIN. Additional users must be assigned the VIEWER role.'
      );
    }

    const { rawToken, tokenHash, expiresAt } = SecurityUtils.generateInvitationTokenBundle(7);

    const invitation = await invitationRepository.create({
      familyId: new Types.ObjectId(data.familyId),
      invitedEmail: email,
      invitedBy: new Types.ObjectId(data.invitedByUserId),
      role: Role.VIEWER,
      targetMemberId: data.targetMemberId ? new Types.ObjectId(data.targetMemberId) : undefined,
      branchId: data.branchId ? new Types.ObjectId(data.branchId) : undefined,
      tokenHash,
      expiresAt,
      status: InvitationStatus.PENDING,
    });

    await auditService.log(
      data.familyId,
      data.invitedByUserId.toString(),
      AuditAction.INVITATION_CREATED,
      'FamilyInvitation',
      invitation._id.toString(),
      { invitedEmail: email, role: Role.VIEWER, branchId: data.branchId }
    );

    return {
      invitation: {
        id: invitation._id.toString(),
        familyId: invitation.familyId,
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
        targetMemberId: invitation.targetMemberId,
        branchId: invitation.branchId,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
      rawToken,
    };
  }

  /**
   * Lists invitations for a family.
   */
  async getInvitations(familyId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied to family invitations');
    }

    const canView =
      hasPermission(membership.role, Permission.INVITE_MEMBER) ||
      hasPermission(membership.role, Permission.MANAGE_ROLES);

    if (!canView) {
      throw new ForbiddenError('Permission denied to view invitations');
    }

    const invitations = await invitationRepository.findByFamily(familyId);
    
    // Enrich with inviter and target member details
    return Promise.all(
      invitations.map(async (inv) => {
        const invObj = inv.toObject ? inv.toObject() : inv;
        let inviterName = 'Family Relative';
        if (inv.invitedBy) {
          const inviter = await userRepository.findById(inv.invitedBy);
          if (inviter) {
            inviterName = inviter.displayName || inviter.email;
          }
        }

        let targetMemberName = undefined;
        if (inv.targetMemberId) {
          const m = await memberRepository.findById(inv.targetMemberId);
          if (m) {
            targetMemberName = m.displayName || `${m.firstName} ${m.lastName}`.trim();
          }
        }

        const isExpired = new Date() > new Date(inv.expiresAt);
        const effectiveStatus = (inv.status === InvitationStatus.PENDING && isExpired)
          ? InvitationStatus.EXPIRED
          : inv.status;

        return {
          ...invObj,
          status: effectiveStatus,
          inviterName,
          targetMemberName,
          isExpired,
        };
      })
    );
  }

  /**
   * Resends an existing invitation, refreshing the token and extending expiration by 7 days.
   */
  async resendInvitation(
    familyId: string | Types.ObjectId,
    invitationId: string | Types.ObjectId,
    actorUserId: string | Types.ObjectId
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied');
    }

    const canManage =
      hasPermission(membership.role, Permission.INVITE_MEMBER) ||
      hasPermission(membership.role, Permission.MANAGE_ROLES);

    if (!canManage) {
      throw new ForbiddenError('Permission denied to resend invitations');
    }

    const invitation = await invitationRepository.findById(invitationId);
    if (!invitation || invitation.familyId.toString() !== familyId.toString()) {
      throw new NotFoundError('Invitation not found in this family');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ValidationError('Cannot resend an already accepted invitation');
    }

    const { rawToken, tokenHash, expiresAt } = SecurityUtils.generateInvitationTokenBundle(7);

    invitation.tokenHash = tokenHash;
    invitation.expiresAt = expiresAt;
    invitation.status = InvitationStatus.PENDING;
    await invitation.save();

    await auditService.log(
      familyId,
      actorUserId.toString(),
      AuditAction.INVITATION_RESENT,
      'FamilyInvitation',
      invitation._id.toString(),
      { invitedEmail: invitation.invitedEmail, expiresAt }
    );

    return {
      invitation: {
        id: invitation._id.toString(),
        familyId: invitation.familyId,
        invitedEmail: invitation.invitedEmail,
        role: invitation.role,
        targetMemberId: invitation.targetMemberId,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
      rawToken,
    };
  }

  /**
   * Inspects and retrieves preview details for an invitation without consuming it.
   */
  async getInvitationPreview(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new ValidationError('A valid invitation token is required');
    }

    const tokenHash = SecurityUtils.hashToken(rawToken);
    const invitation = await invitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundError('Invitation is invalid or not found');
    }

    const family = await familyRepository.findById(invitation.familyId);
    const inviter = invitation.invitedBy ? await userRepository.findById(invitation.invitedBy) : null;
    let targetMember = null;
    if (invitation.targetMemberId) {
      targetMember = await memberRepository.findById(invitation.targetMemberId);
    }

    const isExpired = new Date() > invitation.expiresAt;

    return {
      id: invitation._id.toString(),
      familyId: invitation.familyId.toString(),
      familyName: family?.name || 'Heritage Vault',
      familyMotto: family?.motto || '',
      familyDescription: family?.description || '',
      invitedEmail: invitation.invitedEmail,
      role: invitation.role,
      targetMemberId: invitation.targetMemberId?.toString(),
      targetMemberName: targetMember ? (targetMember.displayName || `${targetMember.firstName} ${targetMember.lastName}`.trim()) : null,
      inviterName: inviter ? (inviter.displayName || inviter.email) : 'A Family Administrator',
      expiresAt: invitation.expiresAt,
      status: (invitation.status === InvitationStatus.PENDING && isExpired) ? InvitationStatus.EXPIRED : invitation.status,
      isExpired,
    };
  }

  /**
   * Accepts an invitation using the raw token.
   * Links user to family membership and optionally to their family member node.
   */
  async acceptInvitation(rawToken: string, userId: string | Types.ObjectId) {
    const tokenHash = SecurityUtils.hashToken(rawToken);
    const invitation = await invitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundError('Invitation is invalid or has already been accepted');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ValidationError(`Invitation is no longer valid (status: ${invitation.status})`);
    }

    if (new Date() > invitation.expiresAt) {
      await invitationRepository.updateStatus(invitation._id, InvitationStatus.EXPIRED);
      throw new ValidationError('Invitation has expired');
    }

    const userObjectId = new Types.ObjectId(userId);
    const familyObjectId = new Types.ObjectId(invitation.familyId);

    // Check existing membership
    const existingMembership = await membershipRepository.findByUserAndFamily(
      userObjectId,
      familyObjectId
    );

    if (existingMembership) {
      throw new ConflictError('You already hold active membership in this family');
    }

    // Create FamilyMembership
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[invitation.role] || [];
    const membership = await membershipRepository.create({
      userId: userObjectId,
      familyId: familyObjectId,
      role: invitation.role,
      status: 'ACTIVE',
      permissions: defaultPerms,
      memberId: invitation.targetMemberId || undefined,
      branchId: invitation.branchId || undefined,
    });

    // If targetMemberId was assigned, link the FamilyMember to this user
    if (invitation.targetMemberId) {
      const updateData: any = {
        linkedUserId: userObjectId,
      };
      if (invitation.branchId) {
        updateData.$addToSet = { branchIds: invitation.branchId };
      }
      await memberRepository.update(invitation.targetMemberId, updateData);
    }

    // Mark invitation accepted
    await invitationRepository.updateStatus(invitation._id, InvitationStatus.ACCEPTED, new Date());

    await auditService.log(
      familyObjectId,
      userId.toString(),
      AuditAction.INVITATION_ACCEPTED,
      'FamilyInvitation',
      invitation._id.toString(),
      { role: invitation.role, memberId: invitation.targetMemberId, branchId: invitation.branchId }
    );

    // Notify inviter
    if (invitation.invitedBy) {
      const user = await userRepository.findById(userObjectId);
      const name = user ? (user.displayName || user.email) : 'A relative';
      await notificationService.notifyUser({
        familyId: familyObjectId,
        recipientUserId: invitation.invitedBy,
        type: 'INVITATION_ACCEPTED',
        title: 'Invitation Accepted',
        message: `${name} has accepted your invitation and joined the family!`,
        entityType: 'FamilyMembership',
        entityId: membership._id.toString(),
        actorUserId: userObjectId,
        actorName: name,
      });
    }

    return {
      success: true,
      familyId: invitation.familyId,
      membershipId: membership._id.toString(),
      role: invitation.role,
    };
  }

  /**
   * Declines an invitation by token.
   */
  async declineInvitation(rawToken: string, userId?: string | Types.ObjectId) {
    const tokenHash = SecurityUtils.hashToken(rawToken);
    const invitation = await invitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ValidationError(`Invitation is already ${invitation.status.toLowerCase()}`);
    }

    await invitationRepository.revoke(invitation._id);

    await auditService.log(
      invitation.familyId,
      userId ? userId.toString() : 'guest',
      AuditAction.INVITATION_DECLINED,
      'FamilyInvitation',
      invitation._id.toString(),
      { invitedEmail: invitation.invitedEmail }
    );

    return { success: true };
  }

  /**
   * Revokes an existing pending invitation.
   */
  async revokeInvitation(
    familyId: string | Types.ObjectId,
    invitationId: string | Types.ObjectId,
    actorUserId: string | Types.ObjectId
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied');
    }

    const canRevoke =
      hasPermission(membership.role, Permission.INVITE_MEMBER) ||
      hasPermission(membership.role, Permission.MANAGE_ROLES);

    if (!canRevoke) {
      throw new ForbiddenError('Permission denied to revoke invitations');
    }

    const invitation = await invitationRepository.findById(invitationId);
    if (!invitation || invitation.familyId.toString() !== familyId.toString()) {
      throw new NotFoundError('Invitation not found');
    }

    await invitationRepository.revoke(invitation._id);

    await auditService.log(
      familyId,
      actorUserId.toString(),
      AuditAction.INVITATION_REVOKED,
      'FamilyInvitation',
      invitation._id.toString(),
      { invitedEmail: invitation.invitedEmail }
    );

    return { success: true };
  }
}

export const invitationService = new InvitationService();
