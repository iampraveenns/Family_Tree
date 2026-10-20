import { Request, Response, NextFunction } from 'express';
import { insightsService } from '../services/insightsService.ts';
import { aiHeritageService } from '../services/aiHeritageService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class InsightsController {
  async getFamilyInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user?.userId || (req.user as any)?.id || 'anonymous';

      const insights = await insightsService.getFamilyInsights(familyId, actorUserId);
      sendSuccess(res, insights, 'Family heritage insights retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getBranchInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user?.userId || (req.user as any)?.id || 'anonymous';

      const branchInsights = await insightsService.getBranchInsights(familyId, actorUserId);
      sendSuccess(res, branchInsights, 'Branch analytics retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getAiSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user?.userId || (req.user as any)?.id || 'anonymous';

      const summary = await aiHeritageService.generateHeritageSummary(familyId, actorUserId);
      sendSuccess(res, summary, 'AI heritage narrative synthesized successfully');
    } catch (err) {
      next(err);
    }
  }

  async verifyRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, relationshipId } = req.params;
      const actorUserId = req.user?.userId || (req.user as any)?.id || 'anonymous';

      const verifiedRel = await insightsService.verifyRelationship(familyId, relationshipId, actorUserId);
      sendSuccess(res, verifiedRel, 'Relationship verified successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const insightsController = new InsightsController();
