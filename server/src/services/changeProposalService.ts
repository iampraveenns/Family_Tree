import { Types } from 'mongoose';
import { changeProposalRepository } from '../repositories/changeProposalRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { userRepository } from '../repositories/userRepository.ts';
import { auditService } from './auditService.ts';
import { notificationService } from './notificationService.ts';
import {
  ChangeProposalEntityType,
  ChangeProposalType,
  ChangeProposalStatus,
} from '../models/ChangeProposal.ts';
import {
  Role,
  normalizeRole,
  Permission,
  AuditAction,
  hasPermission,
} from '../constants/index.ts';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../utils/errors.ts';

export class ChangeProposalService {
  async createProposal(data: {
    familyId: string | Types.ObjectId;
    actorUserId: string | Types.ObjectId;
    entityType: ChangeProposalEntityType;
    changeType: ChangeProposalType;
    entityId?: string | Types.ObjectId;
    title: string;
    description?: string;
    details: Record<string, any>;
  }) {
    const membership = await membershipRepository.findByUserAndFamily(
      data.actorUserId,
      data.familyId
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You are not an active member of this family');
    }

    const user = await userRepository.findById(data.actorUserId);
    const proposerName = user ? (user.displayName || user.email) : 'Family Relative';

    // Verify entity existence if entityId is passed
    if (data.entityId) {
      if (data.entityType === 'MEMBER' || data.entityType === 'BIOGRAPHY') {
        const member = await memberRepository.findById(data.entityId);
        if (!member || member.familyId.toString() !== data.familyId.toString()) {
          throw new NotFoundError('Target family member record not found in this family');
        }
      }
    }

    const proposal = await changeProposalRepository.create({
      familyId: data.familyId,
      proposedBy: data.actorUserId,
      proposerName,
      proposerRole: membership.role,
      entityType: data.entityType,
      changeType: data.changeType,
      entityId: data.entityId,
      title: data.title,
      description: data.description,
      details: data.details,
    });

    await auditService.log(
      data.familyId,
      data.actorUserId.toString(),
      AuditAction.PROPOSAL_CREATED,
      'ChangeProposal',
      proposal._id.toString(),
      {
        entityType: data.entityType,
        changeType: data.changeType,
        title: data.title,
      }
    );

    // Notify admins
    await notificationService.notifyAdmins({
      familyId: data.familyId,
      type: 'NEW_CONTRIBUTION',
      title: 'New Heritage Contribution Submitted',
      message: `${proposerName} submitted "${data.title}" for family review.`,
      entityType: 'ChangeProposal',
      entityId: proposal._id.toString(),
      actorUserId: data.actorUserId,
      actorName: proposerName,
    });

    return proposal;
  }

  async getProposals(
    familyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    options: {
      status?: ChangeProposalStatus;
      entityType?: ChangeProposalEntityType;
      limit?: number;
      skip?: number;
    } = {}
  ) {
    const membership = await membershipRepository.findByUserAndFamily(userId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied');
    }

    const [proposals, total] = await Promise.all([
      changeProposalRepository.findByFamily(familyId, options),
      changeProposalRepository.countByFamily(familyId, options),
    ]);

    return { proposals, total };
  }

  async approveProposal(
    familyId: string | Types.ObjectId,
    proposalId: string | Types.ObjectId,
    reviewerUserId: string | Types.ObjectId,
    reviewNotes?: string
  ) {
    const membership = await membershipRepository.findByUserAndFamily(
      reviewerUserId,
      familyId
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied');
    }

    const canApprove =
      hasPermission(membership.role, Permission.APPROVE_CHANGES) ||
      normalizeRole(membership.role) === Role.ADMIN;

    if (!canApprove) {
      throw new ForbiddenError('You lack permission to approve family changes');
    }

    const proposal = await changeProposalRepository.findById(proposalId);
    if (!proposal || proposal.familyId.toString() !== familyId.toString()) {
      throw new NotFoundError('Proposal not found');
    }

    if (proposal.status !== 'PENDING') {
      throw new ValidationError(`Proposal is already ${proposal.status.toLowerCase()}`);
    }

    const reviewer = await userRepository.findById(reviewerUserId);
    const reviewerName = reviewer ? (reviewer.displayName || reviewer.email) : 'Family Admin';

    // Apply the change
    if (proposal.entityType === 'MEMBER' || proposal.entityType === 'BIOGRAPHY') {
      if (proposal.entityId) {
        await memberRepository.update(proposal.entityId, proposal.details);
      }
    }

    const updated = await changeProposalRepository.updateReviewStatus(proposal._id, {
      status: 'APPROVED',
      reviewedBy: reviewerUserId,
      reviewerName,
      reviewNotes,
    });

    await auditService.log(
      familyId,
      reviewerUserId.toString(),
      AuditAction.PROPOSAL_APPROVED,
      'ChangeProposal',
      proposal._id.toString(),
      {
        title: proposal.title,
        proposerId: proposal.proposedBy.toString(),
        reviewNotes,
      }
    );

    // Notify proposer
    await notificationService.notifyUser({
      familyId,
      recipientUserId: proposal.proposedBy,
      type: 'CONTRIBUTION_APPROVED',
      title: 'Contribution Approved!',
      message: `Your contribution "${proposal.title}" was approved by ${reviewerName}.`,
      entityType: 'ChangeProposal',
      entityId: proposal._id.toString(),
      actorUserId: reviewerUserId,
      actorName: reviewerName,
    });

    return updated;
  }

  async rejectProposal(
    familyId: string | Types.ObjectId,
    proposalId: string | Types.ObjectId,
    reviewerUserId: string | Types.ObjectId,
    reviewNotes?: string
  ) {
    const membership = await membershipRepository.findByUserAndFamily(
      reviewerUserId,
      familyId
    );

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied');
    }

    const canApprove =
      hasPermission(membership.role, Permission.APPROVE_CHANGES) ||
      normalizeRole(membership.role) === Role.ADMIN;

    if (!canApprove) {
      throw new ForbiddenError('You lack permission to review family changes');
    }

    const proposal = await changeProposalRepository.findById(proposalId);
    if (!proposal || proposal.familyId.toString() !== familyId.toString()) {
      throw new NotFoundError('Proposal not found');
    }

    if (proposal.status !== 'PENDING') {
      throw new ValidationError(`Proposal is already ${proposal.status.toLowerCase()}`);
    }

    const reviewer = await userRepository.findById(reviewerUserId);
    const reviewerName = reviewer ? (reviewer.displayName || reviewer.email) : 'Family Admin';

    const updated = await changeProposalRepository.updateReviewStatus(proposal._id, {
      status: 'REJECTED',
      reviewedBy: reviewerUserId,
      reviewerName,
      reviewNotes,
    });

    await auditService.log(
      familyId,
      reviewerUserId.toString(),
      AuditAction.PROPOSAL_REJECTED,
      'ChangeProposal',
      proposal._id.toString(),
      {
        title: proposal.title,
        proposerId: proposal.proposedBy.toString(),
        reviewNotes,
      }
    );

    // Notify proposer
    await notificationService.notifyUser({
      familyId,
      recipientUserId: proposal.proposedBy,
      type: 'CONTRIBUTION_REJECTED',
      title: 'Contribution Update',
      message: `Your contribution "${proposal.title}" was not approved. Notes: ${reviewNotes || 'None provided'}.`,
      entityType: 'ChangeProposal',
      entityId: proposal._id.toString(),
      actorUserId: reviewerUserId,
      actorName: reviewerName,
    });

    return updated;
  }
}

export const changeProposalService = new ChangeProposalService();
