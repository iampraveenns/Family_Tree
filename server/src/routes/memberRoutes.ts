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
import { Permission, Role, normalizeRole } from '../constants/index.ts';

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

const requireMemberUpdateAuth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      return next();
    }

    return requireAuthentication(req, res, (err?: any) => {
      if (err) return next(err);
      return requireFamilyMembership(req, res, async (err2?: any) => {
        if (err2) return next(err2);

        const role = normalizeRole(req.membership?.role);
        if (role === Role.ADMIN) {
          return next();
        }

        // Secure Self-Profile Editing (JWT / Account-to-Node Matching)
        // Allow users to edit only their own profile once a match is confirmed between their logged-in account and their member node
        try {
          const { familyId, memberId } = req.params;
          const { memberRepository } = await import('../repositories/memberRepository.ts');
          const { Types } = await import('mongoose');
          const { ForbiddenError, NotFoundError } = await import('../utils/errors.ts');

          let member = null;
          if (Types.ObjectId.isValid(memberId)) {
            member = (await memberRepository.findByFamilyAndId(familyId, memberId)) || (await memberRepository.findById(memberId));
          }

          if (!member) {
            return next(new NotFoundError(`Member '${memberId}' not found in family '${familyId}'`));
          }

          const authUserId = req.user?.userId;
          const authEmail = req.user?.email?.toLowerCase().trim();

          const isNodeOwner = Boolean(
            (member.linkedUserId && authUserId && member.linkedUserId.toString() === authUserId) ||
            (req.membership?.memberId && req.membership.memberId.toString() === member._id.toString()) ||
            (member.registeredEmail && authEmail && member.registeredEmail.toLowerCase().trim() === authEmail) ||
            ((member as any).email && authEmail && (member as any).email.toLowerCase().trim() === authEmail)
          );

          if (!isNodeOwner) {
            return next(
              new ForbiddenError('You do not have permission to edit this profile. You are only authorized to edit your own profile node.')
            );
          }

          if (!member.linkedUserId && authUserId && Types.ObjectId.isValid(authUserId)) {
            member.linkedUserId = new Types.ObjectId(authUserId);
            await member.save();
          }

          if (req.body) {
            delete req.body.branchIds;
            delete req.body.linkedUserId;
            delete req.body.registeredEmail;
            delete req.body.generation;
          }

          return next();
        } catch (authErr) {
          return next(authErr);
        }
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
  requireMemberUpdateAuth(),
  validate({ body: updateMemberSchema }),
  (req, res, next) => {
    memberController.updateMember(req, res, next);
  }
);

router.put(
  '/:memberId',
  requireMemberUpdateAuth(),
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
