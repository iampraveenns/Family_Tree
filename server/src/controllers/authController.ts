import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { Role } from '../constants/index.ts';

import { ForbiddenError } from '../utils/errors.ts';

export class AuthController {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async register(_req: Request, _res: Response, next: NextFunction) {
    try {
      throw new ForbiddenError(
        'Public registration is disabled. All Admin and Viewer accounts must be provisioned exclusively by the Super Admin.'
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await authService.login({ email, password, ip, userAgent });
      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await authService.refreshToken({ refreshToken, ip, userAgent });
      sendSuccess(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;

      const result = await authService.logout({ refreshToken, userId });
      sendSuccess(res, result, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId || 'guest';
      const result = await authService.getCurrentUser(userId);
      sendSuccess(res, result, 'Current user profile retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getDemoSession(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('user-agent');
      const requestedRole = ((req.query.role as string) || req.body?.role || 'ADMIN').toUpperCase();
      let role = Role.ADMIN;
      let password = 'FamilyRoots#2026';
      if (requestedRole === 'SUPER_ADMIN' || requestedRole === 'SUPERADMIN') {
        role = Role.SUPER_ADMIN;
        password = 'SuperAdmin#2026';
      } else if (requestedRole === 'VIEWER') {
        role = Role.VIEWER;
      }

      const { email } = await authService.ensureDemoUser(role);

      const result = await authService.login({
        email,
        password,
        ip,
        userAgent,
      });

      sendSuccess(res, { ...result, role }, `${role} demo session initialized`);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
