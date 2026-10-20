import mongoose, { Schema, Document, Types } from 'mongoose';
import { RelationshipType, RelationshipStatus } from '../constants/index.ts';

export interface IRelationship extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  sourceMemberId: Types.ObjectId;
  targetMemberId: Types.ObjectId;
  relationshipType: RelationshipType;
  status: RelationshipStatus;
  marriageDate?: string | null;
  siblingOrder?: number | null;
  displayOrder?: number | null;
  createdBy?: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const RelationshipSchema = new Schema<IRelationship>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    sourceMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      required: true,
      index: true,
    },
    targetMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      required: true,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: Object.values(RelationshipType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(RelationshipStatus),
      default: RelationshipStatus.ACTIVE,
      index: true,
    },
    marriageDate: {
      type: String,
      default: null,
    },
    siblingOrder: {
      type: Number,
      default: null,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: null,
    },
    createdBy: {
      type: Schema.Types.Mixed,
      default: 'system',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for graph querying & integrity checks
RelationshipSchema.index(
  { familyId: 1, sourceMemberId: 1, targetMemberId: 1, relationshipType: 1 },
  { unique: false }
);
RelationshipSchema.index({ familyId: 1, sourceMemberId: 1 });
RelationshipSchema.index({ familyId: 1, targetMemberId: 1 });

export const Relationship = mongoose.model<IRelationship>('Relationship', RelationshipSchema);
