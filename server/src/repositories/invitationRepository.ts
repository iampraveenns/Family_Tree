import { Types } from 'mongoose';
import { FamilyInvitation, IFamilyInvitation } from '../models/FamilyInvitation.ts';
import { InvitationStatus } from '../constants/index.ts';

export class InvitationRepository {
  async create(data: Partial<IFamilyInvitation>): Promise<IFamilyInvitation> {
    const invitation = new FamilyInvitation(data);
    return invitation.save();
  }

  async findByTokenHash(tokenHash: string): Promise<IFamilyInvitation | null> {
    return FamilyInvitation.findOne({ tokenHash })
      .populate('familyId', 'name description')
      .populate('invitedBy', 'displayName email')
      .exec();
  }

  async findById(id: string | Types.ObjectId): Promise<IFamilyInvitation | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyInvitation.findById(id).exec();
  }

  async findByFamily(familyId: string | Types.ObjectId): Promise<IFamilyInvitation[]> {
    if (!Types.ObjectId.isValid(familyId)) return [];
    return FamilyInvitation.find({ familyId })
      .populate('invitedBy', 'displayName email')
      .populate('targetMemberId', 'firstName lastName displayName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string | Types.ObjectId,
    status: InvitationStatus,
    acceptedAt?: Date
  ): Promise<IFamilyInvitation | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return FamilyInvitation.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          ...(acceptedAt ? { acceptedAt } : {}),
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  async revoke(id: string | Types.ObjectId): Promise<IFamilyInvitation | null> {
    return this.updateStatus(id, InvitationStatus.REVOKED);
  }
}

export const invitationRepository = new InvitationRepository();
