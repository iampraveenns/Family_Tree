import { Request, Response, NextFunction } from 'express';
import { memberService } from '../services/memberService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { logger } from '../utils/logger.ts';

export class MemberController {
  async createMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;

      if (process.env.NODE_ENV !== 'production') {
        logger.info(
          {
            userId: req.user?.userId,
            requestedFamilyId: req.params.familyId,
            resolvedFamilyId: familyId,
            membershipRole: req.membership?.role,
          },
          '[DevLog] Member creation request received'
        );
      }

      const member = await memberService.createMember(familyId, req.body, { userId: req.user?.userId });
      sendSuccess(res, member, 'Family member created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const { page, limit, search, branchId } = req.query;

      const result = await memberService.getMembers(familyId, {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 25,
        search: search as string | undefined,
        branchId: branchId as string | undefined,
      });

      sendSuccess(res, result.members, 'Family members retrieved successfully', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMemberById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, memberId } = req.params;
      const member = await memberService.getMemberById(familyId, memberId);
      sendSuccess(res, member, 'Member details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, memberId } = req.params;
      const member = await memberService.updateMember(familyId, memberId, req.body, { userId: req.user?.userId });
      sendSuccess(res, member, 'Member updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, memberId } = req.params;
      await memberService.deleteMember(familyId, memberId, { userId: req.user?.userId });
      sendSuccess(res, { deleted: true, memberId }, 'Member deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const memberController = new MemberController();
