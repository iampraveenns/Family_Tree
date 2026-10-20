import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notificationService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { NotFoundError } from '../utils/errors.ts';

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user!.userId;
      const { unreadOnly, limit } = req.query;

      const result = await notificationService.getNotifications(familyId, actorUserId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? Number(limit) : 50,
      });

      sendSuccess(res, result, 'Family notifications retrieved');
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, notificationId } = req.params;
      const actorUserId = req.user!.userId;

      const updated = await notificationService.markAsRead(familyId, notificationId, actorUserId);
      if (!updated) {
        throw new NotFoundError('Notification not found or access denied');
      }

      sendSuccess(res, updated, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user!.userId;

      const result = await notificationService.markAllAsRead(familyId, actorUserId);
      sendSuccess(res, result, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
