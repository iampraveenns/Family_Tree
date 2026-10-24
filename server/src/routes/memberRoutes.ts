import { Router, Request, Response, NextFunction } from 'express';
import { memberController } from '../controllers/memberController.ts';
import { relationshipController } from '../controllers/relationshipController.ts';
import { validate } from '../middleware/validate.ts';
import { createMemberSchema, updateMemberSchema } from '../validators/index.ts';
import {
  requireAuthentication,
  requireFamilyMembership,
  requireFamilyRoles,
  requirePermission,
  requireMemberScope,
} from '../middleware/auth.ts';
import { Permission, Role } from '../constants/index.ts';

const router = Router({ mergeParams: true });

const requireAdminMemberAuth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      return next();
    }

    return requireAuthentication(req, res, (err?: any) => {
      if (err) return next(err);
      return requireFamilyMembership(req, res, (err2?: any) => {
        if (err2) return next(err2);
        return requireFamilyRoles([Role.ADMIN])(req, res, next);
      });
    });
  };
};

const requireReadMemberAuth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      return next();
    }

    return requireAuthentication(req, res, (err?: any) => {
      if (err) return next(err);
      return requireFamilyMembership(req, res, (err2?: any) => {
        if (err2) return next(err2);
        return requireFamilyRoles([Role.ADMIN, Role.VIEWER])(req, res, next);
      });
    });
  };
};

router.post(
  '/',
  requireAdminMemberAuth(),
  validate({ body: createMemberSchema }),
  (req, res, next) => {
    memberController.createMember(req, res, next);
  }
);

router.get('/', requireReadMemberAuth(), (req, res, next) => {
  memberController.getMembers(req, res, next);
});

router.get('/:memberId', requireReadMemberAuth(), (req, res, next) => {
  memberController.getMemberById(req, res, next);
});

router.patch(
  '/:memberId',
  requireAdminMemberAuth(),
  validate({ body: updateMemberSchema }),
  (req, res, next) => {
    memberController.updateMember(req, res, next);
  }
);

router.delete('/:memberId', requireAdminMemberAuth(), (req, res, next) => {
  memberController.deleteMember(req, res, next);
});

// Member relationships endpoint: GET /api/families/:familyId/members/:memberId/relationships
router.get(
  '/:memberId/relationships',
  requireReadMemberAuth(),
  (req, res, next) => {
    relationshipController.getMemberRelationships(req, res, next);
  }
);

export default router;
