import { Request, Response, NextFunction } from 'express';
import { branchService } from '../services/branchService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class BranchController {
  async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const branch = await branchService.createBranch(familyId, req.body, { userId: req.user?.userId });
      sendSuccess(res, branch, 'Branch created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const branches = await branchService.getBranches(familyId, { userId: req.user?.userId });
      sendSuccess(res, branches, 'Branches retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getBranchById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      const branch = await branchService.getBranchById(familyId, branchId, { userId: req.user?.userId });
      sendSuccess(res, branch, 'Branch details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      const branch = await branchService.updateBranch(familyId, branchId, req.body, { userId: req.user?.userId });
      sendSuccess(res, branch, 'Branch updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      await branchService.deleteBranch(familyId, branchId, { userId: req.user?.userId });
      sendSuccess(res, { deleted: true, branchId }, 'Branch deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getBranchExplorer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      const data = await branchService.getBranchExplorer(familyId, branchId, { userId: req.user?.userId });
      sendSuccess(res, data, 'Branch exploration details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async archiveBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      const { isArchived } = req.body;
      const branch = await branchService.archiveBranch(
        familyId,
        branchId,
        isArchived !== false,
        { userId: req.user?.userId }
      );
      sendSuccess(res, branch, `Branch ${branch.isArchived ? 'archived' : 'reactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }

  async assignManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      const { managerIds } = req.body;
      const branch = await branchService.assignManagers(
        familyId,
        branchId,
        managerIds || [],
        { userId: req.user?.userId }
      );
      sendSuccess(res, branch, 'Branch managers assigned successfully');
    } catch (err) {
      next(err);
    }
  }

  async transferMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, branchId } = req.params;
      const { memberId, fromBranchId } = req.body;
      const result = await branchService.transferMember(
        familyId,
        {
          memberId,
          fromBranchId: fromBranchId || branchId,
          targetBranchId: req.body.targetBranchId || branchId,
        },
        { userId: req.user?.userId }
      );
      sendSuccess(res, result, 'Member transferred between branches successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const branchController = new BranchController();
