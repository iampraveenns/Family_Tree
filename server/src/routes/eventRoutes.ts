import { Router } from 'express';
import { eventController } from '../controllers/eventController.ts';
import { requireAuthentication } from '../middleware/auth.ts';

const router = Router({ mergeParams: true });

router.post('/', requireAuthentication, (req, res, next) => {
  eventController.createEvent(req, res, next);
});

router.get('/:eventId', requireAuthentication, (req, res, next) => {
  eventController.getEventById(req, res, next);
});

router.patch('/:eventId', requireAuthentication, (req, res, next) => {
  eventController.updateEvent(req, res, next);
});

router.delete('/:eventId', requireAuthentication, (req, res, next) => {
  eventController.deleteEvent(req, res, next);
});

export default router;
