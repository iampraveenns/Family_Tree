import { Router } from 'express';
import { mediaController } from '../controllers/mediaController.ts';
import { requireAuthentication, authenticate } from '../middleware/auth.ts';

const router = Router();

// Stream endpoints: accessible with either valid signed token in query, active session, or Authorization header
router.get('/:mediaId/stream', authenticate, (req, res, next) => {
  mediaController.streamMedia(req, res, next);
});

router.get('/:mediaId/thumbnail', authenticate, (req, res, next) => {
  mediaController.streamThumbnail(req, res, next);
});

// Authenticated metadata & access token generation
router.get('/:mediaId/access', requireAuthentication, (req, res, next) => {
  mediaController.getMediaAccess(req, res, next);
});

router.get('/:mediaId', requireAuthentication, (req, res, next) => {
  mediaController.getMediaById(req, res, next);
});

router.delete('/:mediaId', requireAuthentication, (req, res, next) => {
  mediaController.deleteMedia(req, res, next);
});

export default router;
