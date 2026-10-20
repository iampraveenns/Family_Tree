import { Request, Response, NextFunction } from 'express';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { authorizationService } from '../services/authorizationService.ts';
import { invitationService } from '../services/invitationService.ts';
import { auditService } from './../services/auditService.ts';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.ts';
import { Role, DEFAULT_ROLE_PERMISSIONS, AuditAction } from '../constants/index.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class MembershipController {
  async getMemberships(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const memberships = await membershipRepository.findByFamily(familyId);
      sendSuccess(res, memberships, 'Family memberships retrieved');
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, membershipId } = req.params;
      const { role } = req.body;
      const actorUserId = req.user!.userId;

      if (!role || !Object.values(Role).includes(role)) {
        throw new ValidationError(`Invalid role: ${role}`);
      }

      const check = await authorizationService.canModifyMembershipRole(
        actorUserId,
        familyId,
        membershipId,
        role as Role
      );

      if (!check.allowed) {
        throw new ForbiddenError(check.reason || 'You are not authorized to assign this role');
      }

      const newPermissions = DEFAULT_ROLE_PERMISSIONS[role as Role] || [];
      const updated = await membershipRepository.updateRole(membershipId, role as Role, newPermissions);

      if (!updated) {
        throw new NotFoundError('Membership not found');
      }

      await auditService.log(
        familyId,
        actorUserId,
        AuditAction.ROLE_CHANGED,
        'FamilyMembership',
        membershipId,
        { newRole: role, targetUserId: updated.userId.toString() }
      );

      sendSuccess(res, updated, 'Role updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeMembership(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, membershipId } = req.params;
      const actorUserId = req.user!.userId;

      const targetMembership = await membershipRepository.findById(membershipId);
      if (!targetMembership || targetMembership.familyId.toString() !== familyId) {
        throw new NotFoundError('Membership not found');
      }

      if (targetMembership.role === Role.FAMILY_OWNER) {
        const ownerCount = await membershipRepository.countOwners(familyId);
        if (ownerCount <= 1) {
          throw new ForbiddenError('Cannot remove the final Family Owner');
        }
      }

      await membershipRepository.delete(membershipId);

      await auditService.log(
        familyId,
        actorUserId,
        AuditAction.ROLE_CHANGED,
        'FamilyMembership',
        membershipId,
        { action: 'REMOVED', targetUserId: targetMembership.userId.toString() }
      );

      sendSuccess(res, { deleted: true, membershipId }, 'Membership removed');
    } catch (error) {
      next(error);
    }
  }

  async createInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const { email, role, targetMemberId, branchId } = req.body;
      const actorUserId = req.user!.userId;

      const result = await invitationService.createInvitation({
        familyId,
        invitedEmail: email,
        role: (role as Role) || Role.MEMBER,
        targetMemberId,
        branchId,
        invitedByUserId: actorUserId,
      });

      sendSuccess(res, result, 'Invitation created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user!.userId;

      const invitations = await invitationService.getInvitations(familyId, actorUserId);
      sendSuccess(res, invitations, 'Invitations retrieved');
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      const actorUserId = req.user!.userId;

      if (!token) {
        throw new ValidationError('Invitation token is required');
      }

      const result = await invitationService.acceptInvitation(token, actorUserId);
      sendSuccess(res, result, 'Invitation accepted');
    } catch (error) {
      next(error);
    }
  }

  async revokeInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, invitationId } = req.params;
      const actorUserId = req.user!.userId;

      const result = await invitationService.revokeInvitation(familyId, invitationId, actorUserId);
      sendSuccess(res, result, 'Invitation revoked');
    } catch (error) {
      next(error);
    }
  }

  async resendInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, invitationId } = req.params;
      const actorUserId = req.user!.userId;

      const result = await invitationService.resendInvitation(familyId, invitationId, actorUserId);
      sendSuccess(res, result, 'Invitation resent successfully');
    } catch (error) {
      next(error);
    }
  }

  async previewInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const token = (req.query.token as string) || (req.body && req.body.token);
      if (!token) {
        throw new ValidationError('Invitation token query parameter is required');
      }

      const preview = await invitationService.getInvitationPreview(token);
      sendSuccess(res, preview, 'Invitation preview details retrieved');
    } catch (error) {
      next(error);
    }
  }

  async declineInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      if (!token) {
        throw new ValidationError('Invitation token is required');
      }

      const result = await invitationService.declineInvitation(token, req.user?.userId);
      sendSuccess(res, result, 'Invitation declined');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, membershipId } = req.params;
      const { status } = req.body;
      const actorUserId = req.user!.userId;

      if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
        throw new ValidationError(`Invalid membership status: ${status}. Must be ACTIVE or SUSPENDED.`);
      }

      const check = await authorizationService.canChangeMembershipStatus(
        actorUserId,
        familyId,
        membershipId,
        status as 'ACTIVE' | 'SUSPENDED'
      );

      if (!check.allowed) {
        throw new ForbiddenError(check.reason || 'Not authorized to change status of this membership');
      }

      const updated = await membershipRepository.updateStatus(membershipId, status as 'ACTIVE' | 'SUSPENDED');
      if (!updated) {
        throw new NotFoundError('Membership not found');
      }

      await auditService.log(
        familyId,
        actorUserId,
        status === 'SUSPENDED' ? AuditAction.MEMBERSHIP_SUSPENDED : AuditAction.MEMBERSHIP_REACTIVATED,
        'FamilyMembership',
        membershipId,
        { targetUserId: updated.userId.toString(), status }
      );

      sendSuccess(res, updated, `Membership ${status.toLowerCase()} successfully`);
    } catch (error) {
      next(error);
    }
  }

  async getMyPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user!.userId;

      const explanation = await authorizationService.getUserPermissionsExplanation(actorUserId, familyId);
      if (!explanation) {
        throw new NotFoundError('Active family membership not found');
      }

      sendSuccess(res, explanation, 'User permissions breakdown retrieved');
    } catch (error) {
      next(error);
    }
  }

  async linkMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, membershipId } = req.params;
      const { memberId } = req.body;
      const actorUserId = req.user!.userId;

      const membership = await membershipRepository.findById(membershipId);
      if (!membership || membership.familyId.toString() !== familyId) {
        throw new NotFoundError('Membership not found');
      }

      if (memberId) {
        const member = await memberRepository.findById(memberId);
        if (!member || member.familyId.toString() !== familyId) {
          throw new NotFoundError('Family member not found in this family');
        }
        await memberRepository.update(memberId, { linkedUserId: membership.userId });
      } else if (membership.memberId) {
        await memberRepository.update(membership.memberId, { linkedUserId: null });
      }

      const updated = await membershipRepository.update(membershipId, {
        memberId: memberId || null,
      });

      await auditService.log(
        familyId,
        actorUserId,
        AuditAction.MEMBER_LINKED_TO_USER,
        'FamilyMembership',
        membershipId,
        { memberId, userId: membership.userId.toString() }
      );

      sendSuccess(res, updated, 'Member link updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const membershipController = new MembershipController();
