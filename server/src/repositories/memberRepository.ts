import { Types } from 'mongoose';
import { FamilyMember, IFamilyMember } from '../models/FamilyMember.ts';

export interface MemberQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  branchId?: string;
}

export class MemberRepository {
  async findById(id: string | Types.ObjectId): Promise<IFamilyMember | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMember.findById(id).exec();
  }

  async findByFamilyAndId(familyId: string | Types.ObjectId, memberId: string | Types.ObjectId): Promise<IFamilyMember | null> {
    if (!Types.ObjectId.isValid(familyId) || !Types.ObjectId.isValid(memberId)) return null;
    return FamilyMember.findOne({ _id: memberId, familyId }).exec();
  }

  async findByFamilyId(
    familyId: string | Types.ObjectId,
    options: MemberQueryOptions = {}
  ): Promise<{ members: IFamilyMember[]; total: number; page: number; limit: number }> {
    if (!Types.ObjectId.isValid(familyId)) {
      return { members: [], total: 0, page: 1, limit: 25 };
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { familyId: new Types.ObjectId(familyId) };

    if (options.branchId && Types.ObjectId.isValid(options.branchId)) {
      query.branchIds = new Types.ObjectId(options.branchId);
    }

    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { displayName: searchRegex },
        { occupation: searchRegex },
      ];
    }

    const [members, total] = await Promise.all([
      FamilyMember.find(query).sort({ generation: 1, dateOfBirth: 1, lastName: 1 }).skip(skip).limit(limit).exec(),
      FamilyMember.countDocuments(query).exec(),
    ]);

    return { members, total, page, limit };
  }

  async findAllByFamily(familyId: string | Types.ObjectId): Promise<IFamilyMember[]> {
    if (!Types.ObjectId.isValid(familyId)) return [];
    return FamilyMember.find({ familyId }).sort({ generation: 1, dateOfBirth: 1 }).exec();
  }

  async findManyByIds(ids: (string | Types.ObjectId)[]): Promise<IFamilyMember[]> {
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];
    return FamilyMember.find({ _id: { $in: validIds } }).exec();
  }

  async create(data: Partial<IFamilyMember>): Promise<IFamilyMember> {
    const member = new FamilyMember(data);
    return member.save();
  }

  async update(id: string | Types.ObjectId, data: Partial<IFamilyMember>): Promise<IFamilyMember | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMember.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await FamilyMember.findByIdAndDelete(id).exec();
    return !!res;
  }

  async countByFamily(familyId: string | Types.ObjectId): Promise<number> {
    if (!Types.ObjectId.isValid(familyId)) return 0;
    return FamilyMember.countDocuments({ familyId }).exec();
  }
}

export const memberRepository = new MemberRepository();
