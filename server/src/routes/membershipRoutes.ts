import { Router } from 'express';
import { membershipController } from '../controllers/membershipController.ts';
import { auditService } from '../services/auditService.ts';
import { requireAuthentication, requireFamilyMembership, requirePermission } from '../middleware/auth.ts';
import { Permission } from '../constants/index.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

const router = Router({ mergeParams: true });

// Memberships listing
router.get(
  '/',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => membershipController.getMemberships(req, res, next)
);

// Role modification: guarded with MANAGE_ROLES and role hierarchy enforcement
router.patch(
  '/:membershipId/role',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.MANAGE_ROLES),
  (req, res, next) => membershipController.updateRole(req, res, next)
);

// Member status suspension / reactivation
router.patch(
  '/:membershipId/status',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => membershipController.updateStatus(req, res, next)
);

// Permission transparency: "What can I do?"
router.get(
  '/my-permissions',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => membershipController.getMyPermissions(req, res, next)
);

// Membership removal
router.delete(
  '/:membershipId',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.MANAGE_ROLES),
  (req, res, next) => membershipController.removeMembership(req, res, next)
);

// Link or unlink tree member node to registered user membership
router.put(
  '/:membershipId/link-member',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.MANAGE_ROLES),
  (req, res, next) => membershipController.linkMember(req, res, next)
);

// Invitations: List
router.get(
  '/invitations/all',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.INVITE_MEMBER),
  (req, res, next) => membershipController.getInvitations(req, res, next)
);

// Invitations: Create
router.post(
  '/invitations',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.INVITE_MEMBER),
  (req, res, next) => membershipController.createInvitation(req, res, next)
);

// Invitations: Resend
router.post(
  '/invitations/:invitationId/resend',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.INVITE_MEMBER),
  (req, res, next) => membershipController.resendInvitation(req, res, next)
);

// Invitations: Revoke
router.delete(
  '/invitations/:invitationId',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.INVITE_MEMBER),
  (req, res, next) => membershipController.revokeInvitation(req, res, next)
);

// Audit logs
router.get(
  '/audit-logs/all',
  requireAuthentication,
  requireFamilyMembership,
  requirePermission(Permission.VIEW_AUDIT_LOG),
  async (req, res, next) => {
    try {
      const { familyId } = req.params;
      const { action, entityType, entityId, actorUserId, startDate, endDate } = req.query;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const skip = req.query.skip ? Number(req.query.skip) : 0;

      const filterOptions = {
        action: action ? (String(action).includes(',') ? String(action).split(',') : String(action)) : undefined,
        entityType: entityType ? String(entityType) : undefined,
        entityId: entityId ? String(entityId) : undefined,
        actorUserId: actorUserId ? String(actorUserId) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        limit,
        skip,
      };

      const [logs, total] = await Promise.all([
        auditService.getLogs(familyId, filterOptions),
        auditService.countLogs(familyId, filterOptions),
      ]);

      if (req.query.limit !== undefined || req.query.skip !== undefined || req.query.page !== undefined) {
        sendSuccess(res, { logs, total, limit, skip }, 'Audit logs retrieved');
      } else {
        sendSuccess(res, logs, 'Audit logs retrieved');
      }
    } catch (err) {
      next(err);
    }
  }
);

// Collaborative Family Activity Feed
router.get(
  '/activity-feed',
  requireAuthentication,
  requireFamilyMembership,
  async (req, res, next) => {
    try {
      const { familyId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      const feed = await auditService.getActivityFeed(familyId, limit);
      sendSuccess(res, feed, 'Family activity feed retrieved');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
