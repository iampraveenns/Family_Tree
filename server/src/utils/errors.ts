import { ErrorCode } from '../constants/index.ts';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: ErrorCode | string = ErrorCode.NOT_FOUND) {
    super(message, 404, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, ErrorCode.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Permission denied') {
    super(message, 403, ErrorCode.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode | string = ErrorCode.DUPLICATE_ENTITY) {
    super(message, 409, code);
  }
}
