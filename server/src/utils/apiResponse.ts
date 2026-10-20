import { Response } from 'express';
import { ApiResponse, ApiErrorResponse } from '../types/index.ts';
import { ErrorCode } from '../constants/index.ts';

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): Response => {
  const payload: ApiResponse<T> = {
    success: true,
  };

  if (message !== undefined) {
    payload.message = message;
  }

  if (data !== undefined) {
    payload.data = data;
  }

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
  message: string = 'An unexpected error occurred',
  statusCode: number = 500,
  details?: unknown
): Response => {
  const payload: ApiErrorResponse & { message?: string } = {
    success: false,
    message,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
};
