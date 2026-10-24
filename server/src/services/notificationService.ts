import { Types } from 'mongoose';
import { notificationRepository } from '../repositories/notificationRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { NotificationType } from '../models/FamilyNotification.ts';
import { Role, normalizeRole } from '../constants/index.ts';

export class NotificationService {
  async getNotifications(
    familyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    options: { limit?: number; unreadOnly?: boolean } = {}
  ) {
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.findByUserAndFamily(userId, familyId, options),
      notificationRepository.countUnread(userId, familyId),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  async markAsRead(
    familyId: string | Types.ObjectId,
    notificationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ) {
    const notification = await notificationRepository.markAsRead(notificationId, userId);
    return notification;
  }

  async markAllAsRead(familyId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    const count = await notificationRepository.markAllAsRead(userId, familyId);
    return { modifiedCount: count };
  }

  async notifyUser(data: {
    familyId: string | Types.ObjectId;
    recipientUserId: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string | Types.ObjectId;
    actorName?: string;
  }) {
    // Avoid self-notifications
    if (
      data.actorUserId &&
      data.actorUserId.toString() === data.recipientUserId.toString()
    ) {
      return null;
    }

    return notificationRepository.create({
      familyId: data.familyId,
      recipientUserId: data.recipientUserId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
      actorUserId: data.actorUserId,
      actorName: data.actorName,
    });
  }

  async notifyAdmins(data: {
    familyId: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string | Types.ObjectId;
    actorName?: string;
  }) {
    const memberships = await membershipRepository.findByFamily(data.familyId);
    const adminMembers = memberships.filter(
      (m) =>
        normalizeRole(m.role) === Role.ADMIN &&
        m.status === 'ACTIVE'
    );

    const promises = adminMembers.map((m) => {
      const recipientId = (m.userId as any)?._id || m.userId;
      if (
        data.actorUserId &&
        data.actorUserId.toString() === recipientId.toString()
      ) {
        return Promise.resolve(null);
      }
      return notificationRepository.create({
        familyId: data.familyId,
        recipientUserId: recipientId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actorUserId: data.actorUserId,
        actorName: data.actorName,
      });
    });

    return Promise.all(promises);
  }

  async notifyFamily(data: {
    familyId: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string | Types.ObjectId;
    actorName?: string;
  }) {
    const memberships = await membershipRepository.findByFamily(data.familyId);
    const activeMembers = memberships.filter((m) => m.status === 'ACTIVE');

    const promises = activeMembers.map((m) => {
      const recipientId = (m.userId as any)?._id || m.userId;
      return notificationRepository.create({
        familyId: data.familyId,
        recipientUserId: recipientId,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actorUserId: data.actorUserId,
        actorName: data.actorName,
      });
    });

    return Promise.all(promises);
  }
}

export const notificationService = new NotificationService();
