import { Types } from 'mongoose';
import {
  ChangeProposal,
  IChangeProposal,
  ChangeProposalStatus,
  ChangeProposalEntityType,
  ChangeProposalType,
} from '../models/ChangeProposal.ts';
import { Role } from '../constants/index.ts';

export class ChangeProposalRepository {
  async create(data: {
    familyId: string | Types.ObjectId;
    proposedBy: string | Types.ObjectId;
    proposerName: string;
    proposerRole: Role;
    entityType: ChangeProposalEntityType;
    changeType: ChangeProposalType;
    entityId?: string | Types.ObjectId;
    title: string;
    description?: string;
    details: Record<string, any>;
  }): Promise<IChangeProposal> {
    return ChangeProposal.create({
      familyId: new Types.ObjectId(data.familyId),
      proposedBy: new Types.ObjectId(data.proposedBy),
      proposerName: data.proposerName,
      proposerRole: data.proposerRole,
      entityType: data.entityType,
      changeType: data.changeType,
      entityId: data.entityId ? new Types.ObjectId(data.entityId) : undefined,
      title: data.title,
      description: data.description,
      details: data.details,
      status: 'PENDING',
    });
  }

  async findById(id: string | Types.ObjectId): Promise<IChangeProposal | null> {
    return ChangeProposal.findById(id).exec();
  }

  async findByFamily(
    familyId: string | Types.ObjectId,
    options: {
      status?: ChangeProposalStatus;
      entityType?: ChangeProposalEntityType;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<IChangeProposal[]> {
    const query: any = {
      familyId: new Types.ObjectId(familyId),
    };

    if (options.status) {
      query.status = options.status;
    }
    if (options.entityType) {
      query.entityType = options.entityType;
    }

    return ChangeProposal.find(query)
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 50)
      .exec();
  }

  async countByFamily(
    familyId: string | Types.ObjectId,
    options: {
      status?: ChangeProposalStatus;
      entityType?: ChangeProposalEntityType;
    } = {}
  ): Promise<number> {
    const query: any = {
      familyId: new Types.ObjectId(familyId),
    };

    if (options.status) {
      query.status = options.status;
    }
    if (options.entityType) {
      query.entityType = options.entityType;
    }

    return ChangeProposal.countDocuments(query).exec();
  }

  async updateReviewStatus(
    id: string | Types.ObjectId,
    data: {
      status: ChangeProposalStatus;
      reviewedBy: string | Types.ObjectId;
      reviewerName: string;
      reviewNotes?: string;
    }
  ): Promise<IChangeProposal | null> {
    return ChangeProposal.findByIdAndUpdate(
      id,
      {
        status: data.status,
        reviewedBy: new Types.ObjectId(data.reviewedBy),
        reviewerName: data.reviewerName,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes || '',
      },
      { new: true }
    ).exec();
  }
}

export const changeProposalRepository = new ChangeProposalRepository();
