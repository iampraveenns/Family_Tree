import { Types } from 'mongoose';
import { User, IUser } from '../models/User.ts';
import { UserStatus } from '../constants/index.ts';

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    const normalized = email.toLowerCase().trim();
    return User.findOne({ email: normalized }).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return User.findById(id).exec();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    displayName: string;
    avatar?: string;
    status?: UserStatus;
  }): Promise<IUser> {
    const user = new User({
      ...data,
      email: data.email.toLowerCase().trim(),
      tokenVersion: 0,
      status: data.status || UserStatus.ACTIVE,
    });
    return user.save();
  }

  async updateLastLogin(id: string | Types.ObjectId): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await User.findByIdAndUpdate(id, { $set: { lastLoginAt: new Date() } }).exec();
  }

  async incrementTokenVersion(id: string | Types.ObjectId): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { returnDocument: 'after' }).exec();
  }
}

export const userRepository = new UserRepository();
