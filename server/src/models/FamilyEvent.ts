import mongoose, { Schema, Document, Types } from 'mongoose';
import { EventType, EventVisibility, RecurrenceFrequency, MilestoneImportance } from '../constants/index.ts';

export interface IReminderSettings {
  enabled: boolean;
  daysBefore: number[];
  notifyChannels?: string[];
  customMessage?: string;
}

export interface IRecurrenceRule {
  frequency: RecurrenceFrequency | string;
  interval?: number;
  count?: number;
  until?: Date;
}

export interface IFamilyEvent extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  title: string;
  description?: string;
  eventType: EventType;
  eventDate?: Date;
  approximateDate?: string;
  era?: string;
  location?: string;
  memberIds: Types.ObjectId[];
  branchIds: Types.ObjectId[];
  memoryIds: Types.ObjectId[];
  coverMediaId?: Types.ObjectId;
  recurrence?: RecurrenceFrequency | string | IRecurrenceRule;
  reminderSettings?: IReminderSettings;
  importance: MilestoneImportance | string;
  notes?: string;
  isMilestone?: boolean;
  createdBy: Types.ObjectId;
  visibility: EventVisibility;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const FamilyEventSchema = new Schema<IFamilyEvent>(
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
    eventType: {
      type: String,
      enum: Object.values(EventType),
      required: true,
      index: true,
    },
    eventDate: {
      type: Date,
      index: true,
    },
    approximateDate: {
      type: String,
      trim: true,
      default: '',
    },
    era: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: '',
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
    memoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Memory',
        index: true,
      },
    ],
    coverMediaId: {
      type: Schema.Types.ObjectId,
      ref: 'Media',
      index: true,
    },
    recurrence: {
      type: Schema.Types.Mixed,
      default: RecurrenceFrequency.NONE,
    },
    reminderSettings: {
      enabled: { type: Boolean, default: false },
      daysBefore: [{ type: Number }],
      notifyChannels: [{ type: String }],
      customMessage: { type: String, trim: true },
    },
    importance: {
      type: String,
      enum: Object.values(MilestoneImportance),
      default: MilestoneImportance.NORMAL,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isMilestone: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    visibility: {
      type: String,
      enum: Object.values(EventVisibility),
      default: EventVisibility.FAMILY,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Performance compound indexes for timelines, member filters, branch filters, and date sorting
FamilyEventSchema.index({ familyId: 1, eventDate: 1, status: 1 });
FamilyEventSchema.index({ familyId: 1, eventType: 1, status: 1 });
FamilyEventSchema.index({ familyId: 1, isMilestone: 1, eventDate: 1 });
FamilyEventSchema.index({ familyId: 1, importance: 1 });
FamilyEventSchema.index({ familyId: 1, memberIds: 1 });
FamilyEventSchema.index({ familyId: 1, branchIds: 1 });
FamilyEventSchema.index({ familyId: 1, status: 1, createdAt: -1 });
FamilyEventSchema.index({ title: 'text', description: 'text', location: 'text' });

export const FamilyEvent =
  (mongoose.models.FamilyEvent as mongoose.Model<IFamilyEvent>) ||
  mongoose.model<IFamilyEvent>('FamilyEvent', FamilyEventSchema);
