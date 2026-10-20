import mongoose, { Schema, Document, Types } from 'mongoose';
import { Role, InvitationStatus } from '../constants/index.ts';

export interface IFamilyInvitation extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  invitedEmail: string;
  invitedBy: Types.ObjectId;
  role: Role;
  targetMemberId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt?: Date;
  status: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FamilyInvitationSchema = new Schema<IFamilyInvitation>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    invitedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.MEMBER,
      required: true,
    },
    targetMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      default: null,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(InvitationStatus),
      default: InvitationStatus.PENDING,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

FamilyInvitationSchema.index({ familyId: 1, invitedEmail: 1, status: 1 });

export const FamilyInvitation = mongoose.model<IFamilyInvitation>('FamilyInvitation', FamilyInvitationSchema);
