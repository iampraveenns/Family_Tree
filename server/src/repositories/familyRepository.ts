import { Types } from 'mongoose';
import { Family, IFamily } from '../models/Family.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';

export class FamilyRepository {
  async findById(id: string | Types.ObjectId): Promise<IFamily | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Family.findById(id).exec();
  }

  async findAvailableToUser(userId?: string | Types.ObjectId): Promise<IFamily[]> {
    if (userId && Types.ObjectId.isValid(userId)) {
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
      const memberships = await FamilyMembership.find({
        userId: userObjectId,
        status: 'ACTIVE',
      }).select('familyId').lean().exec();

      const memberFamilyIds = memberships.map((m: any) => m.familyId).filter(Boolean);

      return Family.find({
        $or: [
          { createdBy: userObjectId },
          { _id: { $in: memberFamilyIds } },
        ],
      }).sort({ createdAt: -1 }).exec();
    }

    // In production, unauthenticated requests must never leak private family records
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    // Dev mode fallback
    return Family.find().sort({ createdAt: -1 }).exec();
  }

  async create(data: Partial<IFamily>): Promise<IFamily> {
    const family = new Family(data);
    return family.save();
  }

  async update(id: string | Types.ObjectId, data: Partial<IFamily>): Promise<IFamily | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Family.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await Family.findByIdAndDelete(id).exec();
    return !!res;
  }
}

export const familyRepository = new FamilyRepository();
