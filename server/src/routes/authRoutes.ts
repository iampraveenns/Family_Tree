import { Router } from 'express';
import { authController } from '../controllers/authController.ts';
import { membershipController } from '../controllers/membershipController.ts';
import { authLimiter } from '../middleware/rateLimiter.ts';
import { authenticate, requireAuthentication } from '../middleware/auth.ts';

const router = Router();

router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.get('/demo-session', (req, res, next) => authController.getDemoSession(req, res, next));
router.post('/demo-session', (req, res, next) => authController.getDemoSession(req, res, next));
router.post('/refresh', authLimiter, (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.get('/me', authenticate, requireAuthentication, (req, res, next) => authController.getMe(req, res, next));
router.get('/invitations/preview', (req, res, next) => membershipController.previewInvitation(req, res, next));
router.post('/invitations/accept', authenticate, requireAuthentication, (req, res, next) => membershipController.acceptInvitation(req, res, next));
router.post('/invitations/decline', authenticate, (req, res, next) => membershipController.declineInvitation(req, res, next));

export default router;
