import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMemberPrivacySettings {
  visibility: 'FAMILY' | 'PUBLIC' | 'BRANCH' | 'PRIVATE';
  hideLivingDates: boolean;
}

export interface IFamilyMember extends Document {
  _id: Types.ObjectId;
  familyId: Types.ObjectId;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  nickname?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  profilePhoto?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  isLiving: boolean;
  birthPlace?: string;
  deathPlace?: string;
  houseName?: string;
  location?: string;
  occupation?: string;
  education?: string;
  biography?: string;
  createdBy?: Types.ObjectId | string;
  linkedUserId?: Types.ObjectId;
  branchIds: Types.ObjectId[];
  privacySettings: IMemberPrivacySettings;
  generation: number;
  siblingOrder?: number | null;
  displayOrder?: number | null;
  isArchived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MemberPrivacySettingsSchema = new Schema<IMemberPrivacySettings>(
  {
    visibility: {
      type: String,
      enum: ['FAMILY', 'PUBLIC', 'BRANCH', 'PRIVATE'],
      default: 'FAMILY',
    },
    hideLivingDates: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const FamilyMemberSchema = new Schema<IFamilyMember>(
  {
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      default: '',
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      default: '',
      trim: true,
    },
    nickname: {
      type: String,
      default: '',
      trim: true,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    dateOfBirth: {
      type: String,
      default: '',
      trim: true,
    },
    dateOfDeath: {
      type: String,
      default: '',
      trim: true,
    },
    isLiving: {
      type: Boolean,
      default: true,
    },
    birthPlace: {
      type: String,
      default: '',
      trim: true,
    },
    deathPlace: {
      type: String,
      default: '',
      trim: true,
    },
    houseName: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    occupation: {
      type: String,
      default: '',
      trim: true,
    },
    education: {
      type: String,
      default: '',
      trim: true,
    },
    biography: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: Schema.Types.Mixed,
      default: 'system',
    },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    branchIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Branch',
      },
    ],
    privacySettings: {
      type: MemberPrivacySettingsSchema,
      default: () => ({}),
    },
    generation: {
      type: Number,
      default: 1,
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
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
FamilyMemberSchema.index({ familyId: 1, lastName: 1 });
FamilyMemberSchema.index({ familyId: 1, displayName: 1 });
FamilyMemberSchema.index({ familyId: 1, branchIds: 1 });

export const FamilyMember = mongoose.model<IFamilyMember>('FamilyMember', FamilyMemberSchema);
