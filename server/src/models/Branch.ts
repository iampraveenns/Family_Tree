import mongoose, { Schema, Document, Types } from 'mongoose';
import { BranchVisibility } from '../constants/index.ts';

export interface IBranch extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  name: string;
  description?: string;
  rootMemberId: Types.ObjectId;
  coverImage?: string;
  accentColor?: string;
  managerIds: Types.ObjectId[];
  createdBy?: Types.ObjectId | string;
  visibility: BranchVisibility;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    rootMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      required: true,
      index: true,
    },
    coverImage: {
      type: String,
      default: '',
    },
    accentColor: {
      type: String,
      default: '#d4a373',
    },
    managerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: Schema.Types.Mixed,
      default: 'system',
    },
    visibility: {
      type: String,
      enum: Object.values(BranchVisibility),
      default: BranchVisibility.FAMILY,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

BranchSchema.index({ familyId: 1, name: 1 }, { unique: true });

export const Branch = mongoose.model<IBranch>('Branch', BranchSchema);
