import mongoose, { Schema, Document, Types } from 'mongoose';
import { MemoryStatus } from '../constants/index.ts';

export interface IMemoryCollection extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  title: string;
  description?: string;
  coverMediaId?: Types.ObjectId;
  coverImageUrl?: string;
  memoryIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MemoryCollectionSchema = new Schema<IMemoryCollection>(
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
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    coverMediaId: {
      type: Schema.Types.ObjectId,
      ref: 'Media',
    },
    coverImageUrl: {
      type: String,
      trim: true,
    },
    memoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Memory',
        index: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

MemoryCollectionSchema.index({ familyId: 1, status: 1, createdAt: -1 });
MemoryCollectionSchema.index({ familyId: 1, title: 1 });

export const MemoryCollection = mongoose.model<IMemoryCollection>(
  'MemoryCollection',
  MemoryCollectionSchema
);
