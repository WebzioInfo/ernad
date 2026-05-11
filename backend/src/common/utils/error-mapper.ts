import { HttpStatus } from '@nestjs/common';

export interface UserSafeError {
  message: string;
  errorCode: string;
  status: HttpStatus;
}

export class ErrorMapper {
  /**
   * Maps technical database/system errors to professional user-safe messages.
   */
  static map(exception: any): UserSafeError {
    const message = exception.message || '';
    const code = exception.code || '';

    // 1. PostgreSQL / Drizzle Error Mapping
    if (message.includes('unique constraint') || code === '23505') {
      return {
        message: 'This record already exists in the system.',
        errorCode: 'DUPLICATE_ENTRY',
        status: HttpStatus.CONFLICT,
      };
    }

    if (message.includes('foreign key constraint') || code === '23503') {
      return {
        message: 'This operation cannot be completed because the record is linked to other data.',
        errorCode: 'LINKED_RECORD_ERROR',
        status: HttpStatus.BAD_REQUEST,
      };
    }

    if (message.includes('not-null constraint') || code === '23502') {
      return {
        message: 'Required information is missing.',
        errorCode: 'MISSING_REQUIRED_DATA',
        status: HttpStatus.BAD_REQUEST,
      };
    }

    // 2. Connection / Infrastructure Errors (Like the Upstash error)
    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
      return {
        message: 'Service is temporarily unavailable. Please try again later.',
        errorCode: 'SERVICE_UNAVAILABLE',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      };
    }

    // 3. Auth Specific (Sanitizing internal JWT/Passport errors)
    if (message.includes('jwt') || message.includes('unauthorized') || message.includes('token')) {
      return {
        message: 'Session expired or invalid. Please login again.',
        errorCode: 'AUTH_INVALID',
        status: HttpStatus.UNAUTHORIZED,
      };
    }

    // Default: Mask everything else as a generic server error
    return {
      message: 'Something went wrong while processing your request. Please try again.',
      errorCode: 'INTERNAL_SERVER_ERROR',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
