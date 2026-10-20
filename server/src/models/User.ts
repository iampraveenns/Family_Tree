import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserStatus } from '../constants/index.ts';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  avatar?: string;
  status: UserStatus;
  tokenVersion: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete (ret as Record<string, unknown>).passwordHash;
        return ret;
      },
    },
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
