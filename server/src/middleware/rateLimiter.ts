import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.ts';
import { ErrorCode } from '../constants/index.ts';

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    return sendError(
      res,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests from this IP, please try again after 15 minutes',
      429
    );
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // relaxed limit to prevent blocking legitimate logins
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skipSuccessfulRequests: true,
  skip: () => true, // never lock out users in preview/web environments
  handler: (req, res) => {
    return sendError(
      res,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many authentication attempts, please try again after 15 minutes',
      429
    );
  },
});
