import { Router } from 'express';
import { eventController } from '../controllers/eventController.ts';
import { requireAuthentication } from '../middleware/auth.ts';
import { validate } from '../middleware/validate.ts';
import { createMilestoneSchema, updateMilestoneSchema } from '../validators/index.ts';

const router = Router({ mergeParams: true });

// Specific milestone collection query endpoints
router.get('/today', requireAuthentication, (req, res, next) => {
  eventController.getTodayMilestones(req, res, next);
});

router.get('/upcoming', requireAuthentication, (req, res, next) => {
  eventController.getUpcomingMilestones(req, res, next);
});

router.get('/month', requireAuthentication, (req, res, next) => {
  eventController.getMonthMilestones(req, res, next);
});

router.get('/historical', requireAuthentication, (req, res, next) => {
  eventController.getHistoricalAnniversaries(req, res, next);
});

// Primary Milestone CRUD endpoints
router.get('/', requireAuthentication, (req, res, next) => {
  eventController.getMilestones(req, res, next);
});

router.post('/', requireAuthentication, validate({ body: createMilestoneSchema }), (req, res, next) => {
  eventController.createMilestone(req, res, next);
});

router.get('/:id', requireAuthentication, (req, res, next) => {
  eventController.getMilestoneById(req, res, next);
});

router.patch('/:id', requireAuthentication, validate({ body: updateMilestoneSchema }), (req, res, next) => {
  eventController.updateMilestone(req, res, next);
});

router.delete('/:id', requireAuthentication, (req, res, next) => {
  eventController.deleteMilestone(req, res, next);
});

export default router;
