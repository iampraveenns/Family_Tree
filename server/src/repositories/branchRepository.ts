import { Types } from 'mongoose';
import { Branch, IBranch } from '../models/Branch.ts';

export class BranchRepository {
  async findById(id: string | Types.ObjectId): Promise<IBranch | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Branch.findById(id).exec();
  }

  async findByFamilyAndId(familyId: string | Types.ObjectId, branchId: string | Types.ObjectId): Promise<IBranch | null> {
    if (!Types.ObjectId.isValid(familyId)) return null;
    if (Types.ObjectId.isValid(branchId)) {
      return Branch.findOne({ _id: branchId, familyId }).exec();
    }
    // If branchId is a slug or name string (e.g. 'branch-arun-branch' or 'Arun Branch')
    if (typeof branchId === 'string' && branchId.trim()) {
      const cleanName = branchId.replace(/^branch-/, '').replace(/[-_]/g, ' ').trim();
      return Branch.findOne({
        familyId,
        $or: [
          { name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { name: { $regex: new RegExp(`^${branchId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      }).exec();
    }
    return null;
  }

  async findByFamilyId(familyId: string | Types.ObjectId): Promise<IBranch[]> {
    if (!Types.ObjectId.isValid(familyId)) return [];
    return Branch.find({ familyId }).sort({ name: 1 }).exec();
  }

  async findByName(familyId: string | Types.ObjectId, name: string): Promise<IBranch | null> {
    if (!Types.ObjectId.isValid(familyId)) return null;
    return Branch.findOne({ familyId, name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } }).exec();
  }

  async create(data: Partial<IBranch>): Promise<IBranch> {
    const branch = new Branch(data);
    return branch.save();
  }

  async update(id: string | Types.ObjectId, data: Partial<IBranch>): Promise<IBranch | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Branch.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await Branch.findByIdAndDelete(id).exec();
    return !!res;
  }
}

export const branchRepository = new BranchRepository();
