import { Router, Request, Response, NextFunction } from 'express';
import { familyController } from '../controllers/familyController.ts';
import { onboardingController } from '../controllers/onboardingController.ts';
import { treeController } from '../controllers/treeController.ts';
import { kinshipController } from '../controllers/kinshipController.ts';
import { searchController } from '../controllers/searchController.ts';
import memberRoutes from './memberRoutes.ts';
import relationshipRoutes from './relationshipRoutes.ts';
import branchRoutes from './branchRoutes.ts';
import membershipRoutes from './membershipRoutes.ts';
import familyMemoryRoutes from './familyMemoryRoutes.ts';
import collectionRoutes from './collectionRoutes.ts';
import mediaRoutes from './mediaRoutes.ts';
import { membershipController } from '../controllers/membershipController.ts';
import { eventController } from '../controllers/eventController.ts';
import eventRoutes from './eventRoutes.ts';
import milestoneRoutes from './milestoneRoutes.ts';
import changeProposalRoutes from './changeProposalRoutes.ts';
import notificationRoutes from './notificationRoutes.ts';
import insightsRoutes from './insightsRoutes.ts';
import backupRoutes from './backupRoutes.ts';
import { auditService } from '../services/auditService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import {
  requireAuthentication,
  requireFamilyMembership,
  requirePermission,
} from '../middleware/auth.ts';
import { validate } from '../middleware/validate.ts';
import { createFamilySchema, updateFamilySchema, onboardingSetupSchema } from '../validators/index.ts';
import { Permission } from '../constants/index.ts';

const router = Router();

const conditionalFamilyAuth = (permission?: Permission) => {
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

// Top-level family routes
router.post('/onboarding', validate({ body: onboardingSetupSchema }), (req, res, next) => {
  onboardingController.setupFamilyVault(req, res, next);
});

router.post('/', validate({ body: createFamilySchema }), (req, res, next) => {
  familyController.createFamily(req, res, next);
});

router.get('/', (req, res, next) => {
  familyController.getFamilies(req, res, next);
});

router.get('/:familyId', conditionalFamilyAuth(Permission.VIEW_FAMILY), (req, res, next) => {
  familyController.getFamilyById(req, res, next);
});

router.patch(
  '/:familyId',
  conditionalFamilyAuth(Permission.MANAGE_FAMILY),
  validate({ body: updateFamilySchema }),
  (req, res, next) => {
    familyController.updateFamily(req, res, next);
  }
);

router.delete(
  '/:familyId',
  conditionalFamilyAuth(Permission.DELETE_FAMILY),
  (req, res, next) => {
    familyController.deleteFamily(req, res, next);
  }
);

// Tree API endpoint: GET /api/families/:familyId/tree
router.get('/:familyId/tree', conditionalFamilyAuth(Permission.VIEW_FAMILY), (req, res, next) => {
  treeController.getFamilyTree(req, res, next);
});

// Kinship API endpoint: GET /api/families/:familyId/kinship/:sourceMemberId/:targetMemberId
router.get(
  '/:familyId/kinship/common-ancestors/:memberAId/:memberBId',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    kinshipController.getCommonAncestors(req, res, next);
  }
);

router.get(
  '/:familyId/kinship/:sourceMemberId/:targetMemberId',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    kinshipController.getKinship(req, res, next);
  }
);

// Global Search API endpoints: GET /api/families/:familyId/search
router.get(
  '/:familyId/search/suggestions',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    searchController.getSuggestions(req, res, next);
  }
);

router.get(
  '/:familyId/search',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    searchController.globalSearch(req, res, next);
  }
);

// Global invitation accept endpoint
router.post('/invitations/accept', requireAuthentication, (req, res, next) => {
  membershipController.acceptInvitation(req, res, next);
});

// Timeline API endpoints
router.get(
  '/:familyId/timeline/story',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    eventController.getStoryChapters(req, res, next);
  }
);

router.get(
  '/:familyId/timeline/on-this-day',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    eventController.getOnThisDay(req, res, next);
  }
);

router.get(
  '/:familyId/timeline/upcoming-anniversaries',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    eventController.getUpcomingAnniversaries(req, res, next);
  }
);

router.get(
  '/:familyId/timeline',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  (req, res, next) => {
    eventController.getTimeline(req, res, next);
  }
);

// Collaborative activity feed
router.get(
  '/:familyId/activity',
  conditionalFamilyAuth(Permission.VIEW_FAMILY),
  async (req, res, next) => {
    try {
      const { familyId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : 25;
      const feed = await auditService.getActivityFeed(familyId, limit);
      sendSuccess(res, feed, 'Family activity feed retrieved');
    } catch (error) {
      next(error);
    }
  }
);

// Nested sub-routes for family-scoped resources
router.use('/:familyId/members', memberRoutes);
router.use('/:familyId/relationships', relationshipRoutes);
router.use('/:familyId/branches', branchRoutes);
router.use('/:familyId/memberships', membershipRoutes);
router.use('/:familyId/memories', familyMemoryRoutes);
router.use('/:familyId/collections', collectionRoutes);
router.use('/:familyId/media', mediaRoutes);
router.use('/:familyId/events', eventRoutes);
router.use('/:familyId/milestones', milestoneRoutes);
router.use('/:familyId/changes', changeProposalRoutes);
router.use('/:familyId/notifications', notificationRoutes);
router.use('/:familyId/insights', insightsRoutes);
router.use('/:familyId', backupRoutes);

export default router;
