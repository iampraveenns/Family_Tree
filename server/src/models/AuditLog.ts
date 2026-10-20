import mongoose, { Schema, Document, Types } from 'mongoose';
import { AuditAction } from '../constants/index.ts';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  familyId?: Types.ObjectId;
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: false,
      default: null,
      index: true,
    },
    actorUserId: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

AuditLogSchema.index({ familyId: 1, createdAt: -1 });
AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
