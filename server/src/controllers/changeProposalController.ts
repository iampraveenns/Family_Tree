import { Request, Response, NextFunction } from 'express';
import { changeProposalService } from '../services/changeProposalService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { ValidationError } from '../utils/errors.ts';

export class ChangeProposalController {
  async createProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const { entityType, changeType, entityId, title, description, details } = req.body;
      const actorUserId = req.user!.userId;

      if (!entityType || !title) {
        throw new ValidationError('entityType and title are required for change proposals');
      }

      const proposal = await changeProposalService.createProposal({
        familyId,
        actorUserId,
        entityType,
        changeType: changeType || 'UPDATE',
        entityId,
        title,
        description,
        details: details || {},
      });

      sendSuccess(res, proposal, 'Change proposal submitted for family review', 201);
    } catch (error) {
      next(error);
    }
  }

  async getProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user!.userId;
      const { status, entityType, limit, skip } = req.query;

      const result = await changeProposalService.getProposals(familyId, actorUserId, {
        status: status as any,
        entityType: entityType as any,
        limit: limit ? Number(limit) : 50,
        skip: skip ? Number(skip) : 0,
      });

      sendSuccess(res, result, 'Change proposals retrieved');
    } catch (error) {
      next(error);
    }
  }

  async approveProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, proposalId } = req.params;
      const { reviewNotes } = req.body;
      const reviewerUserId = req.user!.userId;

      const updated = await changeProposalService.approveProposal(
        familyId,
        proposalId,
        reviewerUserId,
        reviewNotes
      );

      sendSuccess(res, updated, 'Proposal approved and applied to family vault');
    } catch (error) {
      next(error);
    }
  }

  async rejectProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, proposalId } = req.params;
      const { reviewNotes } = req.body;
      const reviewerUserId = req.user!.userId;

      const updated = await changeProposalService.rejectProposal(
        familyId,
        proposalId,
        reviewerUserId,
        reviewNotes
      );

      sendSuccess(res, updated, 'Proposal rejected');
    } catch (error) {
      next(error);
    }
  }
}

export const changeProposalController = new ChangeProposalController();
