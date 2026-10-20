import { Request, Response, NextFunction } from 'express';
import { onboardingService } from '../services/onboardingService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class OnboardingController {
  async setupFamilyVault(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await onboardingService.setupFamilyVault(req.body, {
        userId: req.user?.userId,
      });
      sendSuccess(res, summary, 'Family vault established and onboarded successfully', 201);
    } catch (err) {
      next(err);
    }
  }
}

export const onboardingController = new OnboardingController();
