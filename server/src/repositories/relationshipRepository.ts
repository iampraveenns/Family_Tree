import { Types } from 'mongoose';
import { Relationship, IRelationship } from '../models/Relationship.ts';
import { RelationshipType, RelationshipStatus } from '../constants/index.ts';

export class RelationshipRepository {
  async findById(id: string | Types.ObjectId): Promise<IRelationship | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Relationship.findById(id).exec();
  }

  async findByFamilyAndId(familyId: string | Types.ObjectId, relationshipId: string | Types.ObjectId): Promise<IRelationship | null> {
    if (!Types.ObjectId.isValid(familyId) || !Types.ObjectId.isValid(relationshipId)) return null;
    return Relationship.findOne({ _id: relationshipId, familyId }).exec();
  }

  async findByFamilyId(familyId: string | Types.ObjectId): Promise<IRelationship[]> {
    if (!Types.ObjectId.isValid(familyId)) return [];
    return Relationship.find({ familyId }).sort({ siblingOrder: 1, displayOrder: 1, createdAt: 1 }).exec();
  }

  async findByMemberId(familyId: string | Types.ObjectId, memberId: string | Types.ObjectId): Promise<IRelationship[]> {
    if (!Types.ObjectId.isValid(familyId) || !Types.ObjectId.isValid(memberId)) return [];
    const targetObjId = new Types.ObjectId(memberId);
    return Relationship.find({
      familyId,
      $or: [{ sourceMemberId: targetObjId }, { targetMemberId: targetObjId }],
    }).exec();
  }

  async findExact(
    familyId: string | Types.ObjectId,
    sourceMemberId: string | Types.ObjectId,
    targetMemberId: string | Types.ObjectId,
    relationshipType: RelationshipType
  ): Promise<IRelationship | null> {
    return Relationship.findOne({
      familyId,
      sourceMemberId,
      targetMemberId,
      relationshipType,
    }).exec();
  }

  /**
   * For symmetric relationships (SPOUSE, SIBLING), checks either direction A->B or B->A
   */
  async findSymmetric(
    familyId: string | Types.ObjectId,
    memberAId: string | Types.ObjectId,
    memberBId: string | Types.ObjectId,
    relationshipType: RelationshipType
  ): Promise<IRelationship | null> {
    return Relationship.findOne({
      familyId,
      relationshipType,
      $or: [
        { sourceMemberId: memberAId, targetMemberId: memberBId },
        { sourceMemberId: memberBId, targetMemberId: memberAId },
      ],
    }).exec();
  }

  /**
   * Returns all PARENT relationships in a family for DAG analysis and cycle detection
   */
  async findAllParentRelationships(familyId: string | Types.ObjectId): Promise<IRelationship[]> {
    return Relationship.find({
      familyId,
      relationshipType: RelationshipType.PARENT,
    }).exec();
  }

  async create(data: Partial<IRelationship>): Promise<IRelationship> {
    const rel = new Relationship(data);
    return rel.save();
  }

  async update(id: string | Types.ObjectId, data: Partial<IRelationship>): Promise<IRelationship | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Relationship.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await Relationship.findByIdAndDelete(id).exec();
    return !!res;
  }

  async deleteByMember(familyId: string | Types.ObjectId, memberId: string | Types.ObjectId): Promise<number> {
    if (!Types.ObjectId.isValid(familyId) || !Types.ObjectId.isValid(memberId)) return 0;
    const targetObjId = new Types.ObjectId(memberId);
    const res = await Relationship.deleteMany({
      familyId,
      $or: [{ sourceMemberId: targetObjId }, { targetMemberId: targetObjId }],
    }).exec();
    return res.deletedCount || 0;
  }

  /**
   * Finds an active/valid spouse relationship for a member in a given family.
   */
  async findSpouseForMember(
    familyId: string | Types.ObjectId,
    memberId: string | Types.ObjectId
  ): Promise<IRelationship | null> {
    if (!Types.ObjectId.isValid(familyId) || !Types.ObjectId.isValid(memberId)) return null;
    const targetObjId = new Types.ObjectId(memberId);
    return Relationship.findOne({
      familyId,
      relationshipType: RelationshipType.SPOUSE,
      status: { $ne: RelationshipStatus.HISTORICAL },
      $or: [{ sourceMemberId: targetObjId }, { targetMemberId: targetObjId }],
    }).exec();
  }
}

export const relationshipRepository = new RelationshipRepository();
