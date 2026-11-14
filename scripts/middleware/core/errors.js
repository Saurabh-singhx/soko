/**
 * Standard HTTP Error Taxonomy for Soko Middleware Pipeline
 *
 * Provides strongly-typed error classes with standardized HTTP status codes,
 * machine-readable error codes, and contextual metadata.
 */

class HttpError extends Error {
  constructor(statusCode = 500, message = 'Internal Server Error', code = 'INTERNAL_ERROR', extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra || {};
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.message,
      code: this.statusCode,
      errorCode: this.code,
      ...this.extra,
    };
  }
}

class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', extra = {}) {
    super(400, message, code, extra);
  }
}

class UnauthorizedError extends HttpError {
  constructor(
    message = 'Unauthorized: Remote device is not paired or missing valid bearer token. Complete PIN pairing on Desktop Island first.',
    code = 'UNAUTHORIZED',
    extra = {}
  ) {
    const defaultExtra = {
      tokenExpired: false,
      requiresPairing: true,
      ...extra,
    };
    super(401, message, code, defaultExtra);
  }
}

class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden: Access denied by security policy', code = 'FORBIDDEN', extra = {}) {
    super(403, message, code, extra);
  }
}

class TooManyRequestsError extends HttpError {
  constructor(
    message = 'Too Many Requests: Rate limit cooldown active.',
    retryAfter = 15,
    extra = {}
  ) {
    const defaultExtra = {
      status: 'rejected',
      error: 'RATE_LIMITED',
      retryAfter: Number(retryAfter) || 15,
      ...extra,
    };
    super(429, message, extra?.error || 'RATE_LIMITED', defaultExtra);
    this.retryAfter = Number(retryAfter) || 15;
  }

  toJSON() {
    return {
      status: 'rejected',
      error: this.code || 'RATE_LIMITED',
      retryAfter: this.retryAfter,
      message: this.message,
      ...this.extra,
    };
  }
}

class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_ERROR', extra = {}) {
    super(500, message, code, extra);
  }
}

module.exports = {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
  InternalServerError,
};
