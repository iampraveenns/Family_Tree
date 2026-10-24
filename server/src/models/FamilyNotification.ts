import mongoose, { Schema, Document, Types } from 'mongoose';

export type NotificationType =
  | 'INVITATION_RECEIVED'
  | 'INVITATION_ACCEPTED'
  | 'ROLE_CHANGED'
  | 'CONTRIBUTION_APPROVED'
  | 'CONTRIBUTION_REJECTED'
  | 'RELATIONSHIP_UPDATED'
  | 'MILESTONE_ALERT'
  | 'NEW_CONTRIBUTION'
  | 'MEMBER_ADDED'
  | 'MEMORY_ADDED';

export interface IFamilyNotification extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: Types.ObjectId;
  actorName?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FamilyNotificationSchema = new Schema<IFamilyNotification>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'INVITATION_RECEIVED',
        'INVITATION_ACCEPTED',
        'ROLE_CHANGED',
        'CONTRIBUTION_APPROVED',
        'CONTRIBUTION_REJECTED',
        'RELATIONSHIP_UPDATED',
        'MILESTONE_ALERT',
        'NEW_CONTRIBUTION',
        'MEMBER_ADDED',
        'MEMORY_ADDED',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      default: null,
    },
    entityId: {
      type: String,
      default: null,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      default: null,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

FamilyNotificationSchema.index({ recipientUserId: 1, familyId: 1, isRead: 1, createdAt: -1 });

export const FamilyNotification = mongoose.model<IFamilyNotification>(
  'FamilyNotification',
  FamilyNotificationSchema
);
