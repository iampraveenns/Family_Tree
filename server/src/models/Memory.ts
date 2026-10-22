import mongoose, { Schema, Document, Types } from 'mongoose';
import { MemoryType, MemoryVisibility, MemoryStatus } from '../constants/index.ts';

export interface IMemory extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  title: string;
  description?: string;
  memoryType: MemoryType;
  createdBy: Types.ObjectId;
  addedByMemberId?: Types.ObjectId;
  addedByMemberName?: string;
  eventDate?: Date;
  eventDateApprox?: string;
  location?: string;
  visibility: MemoryVisibility;
  memberIds: Types.ObjectId[];
  branchIds: Types.ObjectId[];
  tags: string[];
  coverMediaId?: Types.ObjectId;
  collectionIds?: Types.ObjectId[];
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    memoryType: {
      type: String,
      enum: Object.values(MemoryType),
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    addedByMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      index: true,
    },
    addedByMemberName: {
      type: String,
      trim: true,
    },
    eventDate: {
      type: Date,
      index: true,
    },
    eventDateApprox: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    visibility: {
      type: String,
      enum: Object.values(MemoryVisibility),
      default: MemoryVisibility.FAMILY,
      index: true,
    },
    memberIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FamilyMember',
        index: true,
      },
    ],
    branchIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Branch',
        index: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    coverMediaId: {
      type: Schema.Types.ObjectId,
      ref: 'Media',
    },
    collectionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MemoryCollection',
        index: true,
      },
    ],
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

// Compound and search indexes for high-speed queries
MemorySchema.index({ familyId: 1, status: 1, createdAt: -1 });
MemorySchema.index({ familyId: 1, memoryType: 1, status: 1 });
MemorySchema.index({ familyId: 1, memberIds: 1, status: 1 });
MemorySchema.index({ familyId: 1, branchIds: 1, status: 1 });
MemorySchema.index({ familyId: 1, eventDate: -1 });
MemorySchema.index({ familyId: 1, tags: 1 });
MemorySchema.index({ familyId: 1, visibility: 1, status: 1 });
MemorySchema.index(
  { title: 'text', description: 'text', location: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, location: 3, description: 1 }, name: 'MemoryTextSearch' }
);

export const Memory = mongoose.model<IMemory>('Memory', MemorySchema);
