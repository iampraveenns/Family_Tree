import { Types } from 'mongoose';
import { FamilyNotification, IFamilyNotification, NotificationType } from '../models/FamilyNotification.ts';

export class NotificationRepository {
  async create(data: {
    familyId: string | Types.ObjectId;
    recipientUserId: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string | Types.ObjectId;
    actorName?: string;
  }): Promise<IFamilyNotification> {
    return FamilyNotification.create({
      familyId: new Types.ObjectId(data.familyId),
      recipientUserId: new Types.ObjectId(data.recipientUserId),
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
      actorUserId: data.actorUserId ? new Types.ObjectId(data.actorUserId) : undefined,
      actorName: data.actorName,
      isRead: false,
    });
  }

  async findByUserAndFamily(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId,
    options: { limit?: number; unreadOnly?: boolean } = {}
  ): Promise<IFamilyNotification[]> {
    const query: any = {
      recipientUserId: new Types.ObjectId(userId),
      familyId: new Types.ObjectId(familyId),
    };
    if (options.unreadOnly) {
      query.isRead = false;
    }
    return FamilyNotification.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .exec();
  }

  async countUnread(userId: string | Types.ObjectId, familyId: string | Types.ObjectId): Promise<number> {
    return FamilyNotification.countDocuments({
      recipientUserId: new Types.ObjectId(userId),
      familyId: new Types.ObjectId(familyId),
      isRead: false,
    }).exec();
  }

  async markAsRead(
    notificationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IFamilyNotification | null> {
    return FamilyNotification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        recipientUserId: new Types.ObjectId(userId),
      },
      { isRead: true, readAt: new Date() },
      { new: true }
    ).exec();
  }

  async markAllAsRead(
    userId: string | Types.ObjectId,
    familyId: string | Types.ObjectId
  ): Promise<number> {
    const res = await FamilyNotification.updateMany(
      {
        recipientUserId: new Types.ObjectId(userId),
        familyId: new Types.ObjectId(familyId),
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    ).exec();
    return res.modifiedCount;
  }
}

export const notificationRepository = new NotificationRepository();
