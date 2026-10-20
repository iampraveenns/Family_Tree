import { Router } from 'express';
import { getHealth } from '../controllers/healthController.ts';

const router = Router();

router.get('/', getHealth);

export default router;
