import { Router } from 'express';
import healthRoutes from './healthRoutes.ts';
import authRoutes from './authRoutes.ts';
import familyRoutes from './familyRoutes.ts';
import memoryRoutes from './memoryRoutes.ts';
import mediaRoutes from './mediaRoutes.ts';
import topLevelRoutes from './topLevelRoutes.ts';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/families', familyRoutes);
apiRouter.use('/memories', memoryRoutes);
apiRouter.use('/media', mediaRoutes);
apiRouter.use('/', topLevelRoutes);

export default apiRouter;
