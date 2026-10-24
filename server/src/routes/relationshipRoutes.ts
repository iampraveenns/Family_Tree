import { Router, Request, Response, NextFunction } from 'express';
import { relationshipController } from '../controllers/relationshipController.ts';
import { validate } from '../middleware/validate.ts';
import { createRelationshipSchema, updateRelationshipSchema } from '../validators/index.ts';
import {
  requireAuthentication,
  requireFamilyMembership,
  requireFamilyRoles,
} from '../middleware/auth.ts';
import { Role } from '../constants/index.ts';

const router = Router({ mergeParams: true });

const requireAdminRelationshipAuth = () => {
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

const requireReadRelationshipAuth = () => {
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
  requireAdminRelationshipAuth(),
  validate({ body: createRelationshipSchema }),
  (req, res, next) => {
    relationshipController.createRelationship(req, res, next);
  }
);

router.patch(
  '/:relationshipId',
  requireAdminRelationshipAuth(),
  validate({ body: updateRelationshipSchema }),
  (req, res, next) => {
    relationshipController.updateRelationship(req, res, next);
  }
);

router.get('/', requireReadRelationshipAuth(), (req, res, next) => {
  relationshipController.getRelationships(req, res, next);
});

router.delete(
  '/:relationshipId',
  requireAdminRelationshipAuth(),
  (req, res, next) => {
    relationshipController.deleteRelationship(req, res, next);
  }
);

export default router;
