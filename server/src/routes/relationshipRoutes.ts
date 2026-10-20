import { Router, Request, Response, NextFunction } from 'express';
import { relationshipController } from '../controllers/relationshipController.ts';
import { validate } from '../middleware/validate.ts';
import { createRelationshipSchema, updateRelationshipSchema } from '../validators/index.ts';
import {
  requireAuthentication,
  requireFamilyMembership,
  requirePermission,
} from '../middleware/auth.ts';
import { Permission } from '../constants/index.ts';

const router = Router({ mergeParams: true });

const conditionalRelationshipAuth = (permission?: Permission) => {
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

router.post(
  '/',
  conditionalRelationshipAuth(Permission.EDIT_MEMBER),
  validate({ body: createRelationshipSchema }),
  (req, res, next) => {
    relationshipController.createRelationship(req, res, next);
  }
);

router.patch(
  '/:relationshipId',
  conditionalRelationshipAuth(Permission.EDIT_MEMBER),
  validate({ body: updateRelationshipSchema }),
  (req, res, next) => {
    relationshipController.updateRelationship(req, res, next);
  }
);

router.get('/', conditionalRelationshipAuth(Permission.VIEW_MEMBER), (req, res, next) => {
  relationshipController.getRelationships(req, res, next);
});

router.delete(
  '/:relationshipId',
  conditionalRelationshipAuth(Permission.EDIT_MEMBER),
  (req, res, next) => {
    relationshipController.deleteRelationship(req, res, next);
  }
);

export default router;
