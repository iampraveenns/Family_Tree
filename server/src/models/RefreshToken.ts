import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  familyId?: Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB automatically purges documents when expiresAt is reached
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

RefreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
