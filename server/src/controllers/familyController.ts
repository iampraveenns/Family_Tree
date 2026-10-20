import { Request, Response, NextFunction } from 'express';
import { familyService } from '../services/familyService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class FamilyController {
  async createFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const family = await familyService.createFamily(req.body, {
        userId: req.user?.userId,
      });
      const responseData = {
        ...(typeof family.toObject === 'function' ? family.toObject() : family),
        id: family._id?.toString(),
      };
      sendSuccess(res, responseData, 'Family created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getFamilies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const families = await familyService.getFamilies({
        userId: req.user?.userId,
      });
      const responseData = families.map((f: any) => ({
        ...(typeof f.toObject === 'function' ? f.toObject() : f),
        id: f._id?.toString(),
      }));
      sendSuccess(res, responseData, 'Families retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getFamilyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const family = await familyService.getFamilyById(req.params.familyId);
      const responseData = {
        ...(typeof family.toObject === 'function' ? family.toObject() : family),
        id: family._id?.toString(),
      };
      sendSuccess(res, responseData, 'Family details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const family = await familyService.updateFamily(req.params.familyId, req.body);
      sendSuccess(res, family, 'Family updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await familyService.deleteFamily(req.params.familyId);
      sendSuccess(res, { deleted: true }, 'Family deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const familyController = new FamilyController();
