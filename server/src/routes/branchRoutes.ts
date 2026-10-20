import { Router, Request, Response, NextFunction } from 'express';
import { branchController } from '../controllers/branchController.ts';
import { validate } from '../middleware/validate.ts';
import { requireAuthentication, requireFamilyMembership, requirePermission } from '../middleware/auth.ts';
import { Permission } from '../constants/index.ts';
import { ForbiddenError } from '../utils/errors.ts';
import { authorizationService } from '../services/authorizationService.ts';
import { createBranchSchema, updateBranchSchema } from '../validators/index.ts';

const router = Router({ mergeParams: true });

const conditionalBranchAuth = (permission?: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      return next();
    }
    return requireAuthentication(req, res, (err?: any) => {
      if (err) return next(err);
      return requireFamilyMembership(req, res, (err2?: any) => {
        if (err2) return next(err2);
        if (permission) {
          return requirePermission(permission)(req, res, next);
        }
        return next();
      });
    });
  };
};

const conditionalBranchScope = (
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'ASSIGN_MANAGER' = 'UPDATE'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      return next();
    }
    return requireAuthentication(req, res, (err?: any) => {
      if (err) return next(err);
      return requireFamilyMembership(req, res, async (err2?: any) => {
        if (err2) return next(err2);
        try {
          const authCheck = await authorizationService.canManageBranch(
            req.user!.userId,
            req.params.familyId,
            req.params.branchId,
            action
          );
          if (!authCheck.allowed) {
            return next(
              new ForbiddenError(authCheck.reason || 'Insufficient permissions to manage this branch')
            );
          }
          next();
        } catch (e) {
          next(e);
        }
      });
    });
  };
};

router.post(
  '/',
  conditionalBranchAuth(Permission.MANAGE_BRANCH),
  validate({ body: createBranchSchema }),
  (req, res, next) => {
    branchController.createBranch(req, res, next);
  }
);

router.get('/', conditionalBranchAuth(Permission.VIEW_FAMILY), (req, res, next) => {
  branchController.getBranches(req, res, next);
});

router.get('/:branchId', conditionalBranchAuth(Permission.VIEW_FAMILY), (req, res, next) => {
  branchController.getBranchById(req, res, next);
});

router.get('/:branchId/explorer', conditionalBranchAuth(Permission.VIEW_FAMILY), (req, res, next) => {
  branchController.getBranchExplorer(req, res, next);
});

router.patch(
  '/:branchId',
  conditionalBranchScope('UPDATE'),
  validate({ body: updateBranchSchema }),
  (req, res, next) => {
    branchController.updateBranch(req, res, next);
  }
);

router.patch(
  '/:branchId/archive',
  conditionalBranchScope('ARCHIVE'),
  (req, res, next) => {
    branchController.archiveBranch(req, res, next);
  }
);

router.patch(
  '/:branchId/managers',
  conditionalBranchScope('ASSIGN_MANAGER'),
  (req, res, next) => {
    branchController.assignManagers(req, res, next);
  }
);

router.post(
  '/:branchId/transfer-member',
  conditionalBranchScope('UPDATE'),
  (req, res, next) => {
    branchController.transferMember(req, res, next);
  }
);

router.delete(
  '/:branchId',
  conditionalBranchScope('DELETE'),
  (req, res, next) => {
    branchController.deleteBranch(req, res, next);
  }
);

export default router;
