import { Types } from 'mongoose';
import { RefreshToken, IRefreshToken } from '../models/RefreshToken.ts';

export class RefreshTokenRepository {
  async create(data: {
    userId: string | Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    familyId?: string | Types.ObjectId;
  }): Promise<IRefreshToken> {
    const doc = new RefreshToken({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      familyId: data.familyId || null,
    });
    return doc.save();
  }

  async findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOne({ tokenHash }).exec();
  }

  async revoke(tokenHash: string, replacedBy?: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOneAndUpdate(
      { tokenHash },
      {
        $set: {
          revokedAt: new Date(),
          replacedBy: replacedBy || null,
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  async revokeAllForUser(userId: string | Types.ObjectId): Promise<number> {
    const result = await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    ).exec();
    return result.modifiedCount;
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
