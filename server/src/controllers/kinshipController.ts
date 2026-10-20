import { Request, Response, NextFunction } from 'express';
import { kinshipService } from '../services/kinshipService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class KinshipController {
  async getKinship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, sourceMemberId, targetMemberId } = req.params;
      const kinship = await kinshipService.calculateKinship(familyId, sourceMemberId, targetMemberId);
      sendSuccess(res, kinship, 'Kinship path calculated successfully');
    } catch (err) {
      next(err);
    }
  }

  async getCommonAncestors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, memberAId, memberBId } = req.params;
      const result = await kinshipService.findCommonAncestors(familyId, memberAId, memberBId);
      sendSuccess(res, result, 'Common ancestors retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const kinshipController = new KinshipController();
