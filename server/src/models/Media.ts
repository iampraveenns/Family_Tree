import mongoose, { Schema, Document, Types } from 'mongoose';
import { MediaProcessingStatus, MemoryVisibility, MemoryStatus } from '../constants/index.ts';

export interface IMedia extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  memoryId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  originalFileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  sha256Checksum: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailStorageKey?: string;
  processingStatus: MediaProcessingStatus;
  visibility: MemoryVisibility;
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Memory',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    mimeType: {
      type: String,
      required: true,
      index: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    sha256Checksum: {
      type: String,
      required: true,
      index: true,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    duration: {
      type: Number,
    },
    thumbnailStorageKey: {
      type: String,
    },
    processingStatus: {
      type: String,
      enum: Object.values(MediaProcessingStatus),
      default: MediaProcessingStatus.READY,
      index: true,
    },
    visibility: {
      type: String,
      enum: Object.values(MemoryVisibility),
      default: MemoryVisibility.FAMILY,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MemoryStatus),
      default: MemoryStatus.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
MediaSchema.index({ familyId: 1, memoryId: 1, status: 1 });
MediaSchema.index({ familyId: 1, sha256Checksum: 1 });
MediaSchema.index({ memoryId: 1, status: 1 });

export const Media = mongoose.model<IMedia>('Media', MediaSchema);
