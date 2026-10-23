import mongoose, { Schema, Document, Types } from 'mongoose';
import { Role } from '../constants/index.ts';

export interface IFamilyMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: Types.ObjectId;
  memberId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  role: Role;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FamilyMembershipSchema = new Schema<IFamilyMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      default: null,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'VIEWER', 'FAMILY_OWNER', 'FAMILY_ADMIN', 'BRANCH_MANAGER', 'PARENT_MANAGER', 'MEMBER', 'CONTRIBUTOR'],
      default: Role.VIEWER,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    permissions: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

FamilyMembershipSchema.index({ userId: 1, familyId: 1 }, { unique: true });
FamilyMembershipSchema.index({ familyId: 1, userId: 1 });
FamilyMembershipSchema.index({ familyId: 1, role: 1 });

export const FamilyMembership = mongoose.model<IFamilyMembership>('FamilyMembership', FamilyMembershipSchema);
