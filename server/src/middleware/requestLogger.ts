import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.ts';

/**
 * Strips sensitive tokens or secrets from query strings for logging.
 */
function sanitizeUrlForLogs(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl, 'http://localhost');
    if (urlObj.searchParams.has('token')) {
      urlObj.searchParams.set('token', '[REDACTED]');
    }
    if (urlObj.searchParams.has('password')) {
      urlObj.searchParams.set('password', '[REDACTED]');
    }
    return urlObj.pathname + (urlObj.search ? urlObj.search : '');
  } catch {
    return rawUrl.replace(/([?&](token|password)=)[^&]+/gi, '$1[REDACTED]');
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Correlation ID
  const incomingRequestId = req.headers['x-request-id'];
  const requestId = (typeof incomingRequestId === 'string' && incomingRequestId.trim())
    ? incomingRequestId.trim()
    : crypto.randomUUID();

  (req as any).id = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;
    const isApi = req.originalUrl.startsWith('/api');

    // Only log API requests or actual HTTP errors (>= 400)
    // Avoid logging routine Vite dev asset fetches (/src/*, /@vite/*, /node_modules/*)
    if (!isApi && !isError) {
      return;
    }

    const sanitizedUrl = sanitizeUrlForLogs(req.originalUrl);

    const logData = {
      requestId,
      method: req.method,
      url: sanitizedUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    if (isError) {
      logger.warn(logData, `HTTP ${req.method} ${sanitizedUrl} finished with status ${res.statusCode}`);
    } else {
      logger.info(logData, `HTTP ${req.method} ${sanitizedUrl} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
};
