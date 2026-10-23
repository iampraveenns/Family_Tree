import { Types } from 'mongoose';
import { FamilyMembership, IFamilyMembership } from '../models/FamilyMembership.ts';
import { Role } from '../constants/index.ts';

export class MembershipRepository {
  async findById(id: string | Types.ObjectId): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMembership.findById(id).exec();
  }

  async findByUserAndFamily(userId: string | Types.ObjectId, familyId: string | Types.ObjectId): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(familyId)) return null;
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const famObjId = typeof familyId === 'string' ? new Types.ObjectId(familyId) : familyId;
    return FamilyMembership.findOne({ userId: userObjId, familyId: famObjId }).exec();
  }

  async findByUser(userId: string | Types.ObjectId): Promise<IFamilyMembership[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    return FamilyMembership.find({ userId, status: 'ACTIVE' })
      .populate('familyId', 'name originPlace motto coverImage')
      .populate('memberId', 'firstName lastName displayName profilePhoto')
      .exec();
  }

  async findByFamily(familyId: string | Types.ObjectId): Promise<IFamilyMembership[]> {
    if (!Types.ObjectId.isValid(familyId)) return [];
    return FamilyMembership.find({ familyId })
      .populate('userId', 'displayName email avatar status')
      .populate('memberId', 'firstName lastName displayName profilePhoto')
      .populate('branchId', 'name accentColor')
      .exec();
  }

  async countAdmins(familyId: string | Types.ObjectId): Promise<number> {
    if (!Types.ObjectId.isValid(familyId)) return 0;
    return FamilyMembership.countDocuments({
      familyId,
      role: { $in: [Role.ADMIN, Role.FAMILY_OWNER, Role.FAMILY_ADMIN] },
      status: 'ACTIVE',
    }).exec();
  }

  async findAdmin(familyId: string | Types.ObjectId): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(familyId)) return null;
    return FamilyMembership.findOne({
      familyId,
      role: { $in: [Role.ADMIN, Role.FAMILY_OWNER, Role.FAMILY_ADMIN] },
      status: 'ACTIVE',
    }).exec();
  }

  async countOwners(familyId: string | Types.ObjectId): Promise<number> {
    return this.countAdmins(familyId);
  }

  async findOwner(familyId: string | Types.ObjectId): Promise<IFamilyMembership | null> {
    return this.findAdmin(familyId);
  }

  async create(data: Partial<IFamilyMembership>): Promise<IFamilyMembership> {
    const membership = new FamilyMembership(data);
    return membership.save();
  }

  async updateRole(id: string | Types.ObjectId, role: Role, permissions: string[]): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMembership.findByIdAndUpdate(
      id,
      { $set: { role, permissions } },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  async updateStatus(id: string | Types.ObjectId, status: 'ACTIVE' | 'SUSPENDED'): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMembership.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  async update(id: string | Types.ObjectId, data: Partial<IFamilyMembership>): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMembership.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after' }
    ).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<IFamilyMembership | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyMembership.findByIdAndDelete(id).exec();
  }
}

export const membershipRepository = new MembershipRepository();
