import { Request, Response, NextFunction } from 'express';
import { treeService } from '../services/treeService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class TreeController {
  async getFamilyTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const treeData = await treeService.getFamilyTree(familyId);
      sendSuccess(res, treeData, 'Family tree retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const treeController = new TreeController();
