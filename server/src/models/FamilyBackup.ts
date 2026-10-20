import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBackupRecordCounts {
  family?: number;
  members: number;
  relationships: number;
  branches: number;
  timelineEvents: number;
  milestones: number;
  memories: number;
  media: number;
  collections: number;
  userAssociations: number;
  auditLogs: number;
}

export type BackupStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'RESTORING';

export interface IFamilyBackup extends Document {
  _id: Types.ObjectId;
  backupId: string;
  familyId: Types.ObjectId;
  storageKey: string;
  archiveSize: number;
  recordCounts: IBackupRecordCounts;
  checksum: string;
  status: BackupStatus;
  schemaVersion: string;
  createdBy: Types.ObjectId;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BackupRecordCountsSchema = new Schema<IBackupRecordCounts>(
  {
    family: { type: Number, default: 1 },
    members: { type: Number, default: 0 },
    relationships: { type: Number, default: 0 },
    branches: { type: Number, default: 0 },
    timelineEvents: { type: Number, default: 0 },
    milestones: { type: Number, default: 0 },
    memories: { type: Number, default: 0 },
    media: { type: Number, default: 0 },
    collections: { type: Number, default: 0 },
    userAssociations: { type: Number, default: 0 },
    auditLogs: { type: Number, default: 0 },
  },
  { _id: false }
);

const FamilyBackupSchema = new Schema<IFamilyBackup>(
  {
    backupId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    archiveSize: {
      type: Number,
      required: true,
      min: 0,
    },
    recordCounts: {
      type: BackupRecordCountsSchema,
      required: true,
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED', 'RESTORING'],
      default: 'COMPLETED',
      index: true,
    },
    schemaVersion: {
      type: String,
      required: true,
      default: '1.0.0',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

FamilyBackupSchema.index({ familyId: 1, createdAt: -1 });

export const FamilyBackup = mongoose.model<IFamilyBackup>('FamilyBackup', FamilyBackupSchema);
