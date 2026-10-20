import { Router, Request, Response, NextFunction } from 'express';
import { memberController } from '../controllers/memberController.ts';
import { relationshipController } from '../controllers/relationshipController.ts';
import { validate } from '../middleware/validate.ts';
import { createMemberSchema, updateMemberSchema } from '../validators/index.ts';
import {
  requireAuthentication,
  requireFamilyMembership,
  requirePermission,
  requireMemberScope,
} from '../middleware/auth.ts';
import { Permission } from '../constants/index.ts';

const router = Router({ mergeParams: true });

const conditionalMemberAuth = (permission?: Permission) => {
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

const conditionalMemberScope = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      return next();
    }

    return requireAuthentication(req, res, (err?: any) => {
      if (err) return next(err);
      return requireFamilyMembership(req, res, (err2?: any) => {
        if (err2) return next(err2);
        return requireMemberScope(permission)(req, res, next);
      });
    });
  };
};

router.post(
  '/',
  conditionalMemberAuth(Permission.CREATE_MEMBER),
  validate({ body: createMemberSchema }),
  (req, res, next) => {
    memberController.createMember(req, res, next);
  }
);

router.get('/', conditionalMemberAuth(Permission.VIEW_MEMBER), (req, res, next) => {
  memberController.getMembers(req, res, next);
});

router.get('/:memberId', conditionalMemberAuth(Permission.VIEW_MEMBER), (req, res, next) => {
  memberController.getMemberById(req, res, next);
});

router.patch(
  '/:memberId',
  conditionalMemberScope(Permission.EDIT_MEMBER),
  validate({ body: updateMemberSchema }),
  (req, res, next) => {
    memberController.updateMember(req, res, next);
  }
);

router.delete('/:memberId', conditionalMemberScope(Permission.DELETE_MEMBER), (req, res, next) => {
  memberController.deleteMember(req, res, next);
});

// Member relationships endpoint: GET /api/families/:familyId/members/:memberId/relationships
router.get(
  '/:memberId/relationships',
  conditionalMemberAuth(Permission.VIEW_MEMBER),
  (req, res, next) => {
    relationshipController.getMemberRelationships(req, res, next);
  }
);

export default router;
