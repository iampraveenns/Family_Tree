import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middleware/requestLogger.ts';
import { standardLimiter } from './middleware/rateLimiter.ts';
import { authenticate } from './middleware/auth.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { NotFoundError } from './utils/errors.ts';
import apiRouter from './routes/index.ts';
import { config } from './config/index.ts';

export function createApp(): Express {
  const app = express();

  // Trust reverse proxy (e.g. Cloud Run, Nginx)
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                mediaSrc: ["'self'", 'blob:', 'data:'],
                connectSrc: ["'self'"],
              },
            }
          : false, // Vite dev server compatibility in development
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Allow framing for the application UI in preview environments while preserving X-Frame-Options on API endpoints
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      res.removeHeader('X-Frame-Options');
    }
    next();
  });

  // CORS Configuration
  const allowedOrigins = [
    config.CLIENT_URL,
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('CORS policy does not allow access from origin'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(requestLogger);

  // API rate limiting
  app.use('/api', standardLimiter);

  // Global authentication extractor (populates req.user if Bearer token present)
  app.use(authenticate);

  // API Routes
  app.use('/api', apiRouter);

  // 404 handler for unmatched API routes
  app.use('/api/*', (req, res, next) => {
    next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found on this server`));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
