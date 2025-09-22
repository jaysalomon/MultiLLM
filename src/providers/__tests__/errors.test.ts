/**
 * Tests for provider error classes
 * Requirements: 2.4, 4.5
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderError,
  AuthenticationError,
  RateLimitError,
  QuotaExceededError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError,
  InvalidRequestError
} from '../errors';

describe('Provider Errors', () => {
  describe('ProviderError', () => {
    it('should create base provider error', () => {
      const error = new ProviderError(
        'Test error',
        'test-provider',
        'TEST_CODE',
        500,
        true
      );

      expect(error.name).toBe('ProviderError');
      expect(error.message).toBe('Test error');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have default retryable value', () => {
      const error = new ProviderError('Test', 'provider');
      expect(error.retryable).toBe(false);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError('test-provider');

      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Authentication failed');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('test-provider', 'Invalid API key');

      expect(error.message).toBe('Invalid API key');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with default message', () => {
      const error = new RateLimitError('test-provider');

      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError('test-provider', 'Custom message', 60);

      expect(error.message).toBe('Custom message');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('QuotaExceededError', () => {
    it('should create quota exceeded error', () => {
      const error = new QuotaExceededError('test-provider');

      expect(error.name).toBe('QuotaExceededError');
      expect(error.message).toBe('Quota exceeded');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('QUOTA_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(false);
    });

    it('should create quota exceeded error with custom message', () => {
      const error = new QuotaExceededError('test-provider', 'Monthly quota exceeded');

      expect(error.message).toBe('Monthly quota exceeded');
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const originalError = new Error('Connection failed');
      const error = new NetworkError('test-provider', 'Network issue', originalError);

      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network issue');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBeUndefined();
      expect(error.retryable).toBe(true);
      expect(error.originalError).toBe(originalError);
    });

    it('should create network error without original error', () => {
      const error = new NetworkError('test-provider', 'Network issue');

      expect(error.originalError).toBeUndefined();
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('test-provider', 30000);

      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Request timed out after 30000ms');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBeUndefined();
      expect(error.retryable).toBe(true);
    });
  });

  describe('ModelNotFoundError', () => {
    it('should create model not found error', () => {
      const error = new ModelNotFoundError('test-provider', 'gpt-4');

      expect(error.name).toBe('ModelNotFoundError');
      expect(error.message).toBe("Model 'gpt-4' not found");
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('MODEL_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
    });
  });

  describe('InvalidRequestError', () => {
    it('should create invalid request error', () => {
      const error = new InvalidRequestError('test-provider', 'Invalid parameters');

      expect(error.name).toBe('InvalidRequestError');
      expect(error.message).toBe('Invalid parameters');
      expect(error.providerId).toBe('test-provider');
      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Error inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const authError = new AuthenticationError('test');
      const rateLimitError = new RateLimitError('test');
      const networkError = new NetworkError('test', 'message');

      expect(authError).toBeInstanceOf(ProviderError);
      expect(authError).toBeInstanceOf(Error);
      
      expect(rateLimitError).toBeInstanceOf(ProviderError);
      expect(rateLimitError).toBeInstanceOf(Error);
      
      expect(networkError).toBeInstanceOf(ProviderError);
      expect(networkError).toBeInstanceOf(Error);
    });

    it('should be catchable as ProviderError', () => {
      const errors = [
        new AuthenticationError('test'),
        new RateLimitError('test'),
        new NetworkError('test', 'message'),
        new TimeoutError('test', 1000),
        new ModelNotFoundError('test', 'model'),
        new InvalidRequestError('test', 'message')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(ProviderError);
      });
    });
  });
});