/**
 * Provider-specific error classes
 * Requirements: 2.4, 4.5
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor(providerId: string, message: string = 'Authentication failed') {
    super(message, providerId, 'AUTH_ERROR', 401, false);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(
    providerId: string,
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number
  ) {
    super(message, providerId, 'RATE_LIMIT', 429, true);
    this.name = 'RateLimitError';
  }
}

export class QuotaExceededError extends ProviderError {
  constructor(providerId: string, message: string = 'Quota exceeded') {
    super(message, providerId, 'QUOTA_EXCEEDED', 429, false);
    this.name = 'QuotaExceededError';
  }
}

export class NetworkError extends ProviderError {
  constructor(providerId: string, message: string, public readonly originalError?: Error) {
    super(message, providerId, 'NETWORK_ERROR', undefined, true);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ProviderError {
  constructor(providerId: string, timeout: number) {
    super(`Request timed out after ${timeout}ms`, providerId, 'TIMEOUT', undefined, true);
    this.name = 'TimeoutError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(providerId: string, modelName: string) {
    super(`Model '${modelName}' not found`, providerId, 'MODEL_NOT_FOUND', 404, false);
    this.name = 'ModelNotFoundError';
  }
}

export class InvalidRequestError extends ProviderError {
  constructor(providerId: string, message: string) {
    super(message, providerId, 'INVALID_REQUEST', 400, false);
    this.name = 'InvalidRequestError';
  }
}