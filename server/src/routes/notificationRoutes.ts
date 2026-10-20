import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.ts';
import { requireAuthentication, requireFamilyMembership } from '../middleware/auth.ts';

const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => notificationController.getNotifications(req, res, next)
);

router.patch(
  '/:notificationId/read',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => notificationController.markAsRead(req, res, next)
);

router.post(
  '/read-all',
  requireAuthentication,
  requireFamilyMembership,
  (req, res, next) => notificationController.markAllAsRead(req, res, next)
);

export default router;
