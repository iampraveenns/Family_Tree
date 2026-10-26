import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.ts';
import { sendError } from '../utils/apiResponse.ts';
import { ErrorCode } from '../constants/index.ts';
import { logger } from '../utils/logger.ts';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        details: err.details,
        path: req.originalUrl,
      }, 'Operational server error handled');
    } else {
      logger.info({
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        path: req.originalUrl,
      }, 'Client error response sent');
    }

    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Syntax error from body-parser
  if ('type' in err && err.type === 'entity.parse.failed') {
    sendError(res, ErrorCode.VALIDATION_ERROR, 'Malformed JSON payload in request body', 400);
    return;
  }

  // Graceful fallback for database disconnection/errors (as specified in web migration guide)
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerSelectionError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    logger.warn('[AI Studio] Database offline or query timed out — returning fallback response');
    if (req.method === 'GET') {
      res.json({
        success: true,
        data: req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {},
        message: 'Database offline — returning empty response',
      });
      return;
    }
    sendError(res, ErrorCode.DATABASE_ERROR, 'Service temporarily unavailable (database offline)', 503);
    return;
  }

  // Unhandled internal server error
  logger.error({
    err: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    path: req.originalUrl,
  }, 'Unhandled exception occurred');

  sendError(
    res,
    ErrorCode.INTERNAL_SERVER_ERROR,
    process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred'
      : err.message || 'An unexpected internal error occurred',
    500
  );
};
