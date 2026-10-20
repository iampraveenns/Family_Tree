import mongoose, { Schema, Document, Types } from 'mongoose';
import { Role } from '../constants/index.ts';

export type ChangeProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ChangeProposalEntityType = 'MEMBER' | 'RELATIONSHIP' | 'MEMORY' | 'EVENT' | 'BIOGRAPHY';
export type ChangeProposalType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface IChangeProposal extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  proposedBy: Types.ObjectId;
  proposerName: string;
  proposerRole: Role;
  entityType: ChangeProposalEntityType;
  changeType: ChangeProposalType;
  entityId?: Types.ObjectId;
  title: string;
  description?: string;
  details: Record<string, any>;
  status: ChangeProposalStatus;
  reviewedBy?: Types.ObjectId;
  reviewerName?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChangeProposalSchema = new Schema<IChangeProposal>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    proposerName: {
      type: String,
      required: true,
      trim: true,
    },
    proposerRole: {
      type: String,
      enum: Object.values(Role),
      default: Role.CONTRIBUTOR,
    },
    entityType: {
      type: String,
      enum: ['MEMBER', 'RELATIONSHIP', 'MEMORY', 'EVENT', 'BIOGRAPHY'],
      required: true,
      index: true,
    },
    changeType: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
      required: true,
      default: 'UPDATE',
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewerName: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ChangeProposalSchema.index({ familyId: 1, status: 1, createdAt: -1 });

export const ChangeProposal = mongoose.model<IChangeProposal>('ChangeProposal', ChangeProposalSchema);
