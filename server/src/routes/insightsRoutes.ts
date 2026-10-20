import { Router } from 'express';
import { insightsController } from '../controllers/insightsController.ts';
import { requireAuthentication } from '../middleware/auth.ts';

const router = Router({ mergeParams: true });

// All insights endpoints require authentication to enforce RBAC and family isolation
router.use(requireAuthentication);

// GET /api/families/:familyId/insights
router.get('/', (req, res, next) => {
  insightsController.getFamilyInsights(req, res, next);
});

// GET /api/families/:familyId/insights/branches
router.get('/branches', (req, res, next) => {
  insightsController.getBranchInsights(req, res, next);
});

// POST /api/families/:familyId/insights/ai-summary
router.post('/ai-summary', (req, res, next) => {
  insightsController.getAiSummary(req, res, next);
});

// PATCH /api/families/:familyId/insights/verify-relationship/:relationshipId
router.patch('/verify-relationship/:relationshipId', (req, res, next) => {
  insightsController.verifyRelationship(req, res, next);
});

export default router;
