import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFamilySettings {
  defaultMemberVisibility: 'FAMILY' | 'PUBLIC' | 'PRIVATE';
  allowMemberInvitations: boolean;
  allowPublicProfiles: boolean;
  timezone: string;
  dateFormat: string;
}

export interface IFamily extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  coverImage?: string;
  originPlace?: string;
  motto?: string;
  createdBy: Types.ObjectId;
  settings: IFamilySettings;
  createdAt: Date;
  updatedAt: Date;
}

const FamilySettingsSchema = new Schema<IFamilySettings>(
  {
    defaultMemberVisibility: {
      type: String,
      enum: ['FAMILY', 'PUBLIC', 'PRIVATE'],
      default: 'FAMILY',
    },
    allowMemberInvitations: {
      type: Boolean,
      default: true,
    },
    allowPublicProfiles: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD',
    },
  },
  { _id: false }
);

const FamilySchema = new Schema<IFamily>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    coverImage: {
      type: String,
      default: '',
    },
    originPlace: {
      type: String,
      default: '',
      trim: true,
    },
    motto: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    settings: {
      type: FamilySettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret._id) {
          ret.id = ret._id.toString();
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret._id) {
          ret.id = ret._id.toString();
        }
        return ret;
      },
    },
  }
);

export const Family = mongoose.model<IFamily>('Family', FamilySchema);
