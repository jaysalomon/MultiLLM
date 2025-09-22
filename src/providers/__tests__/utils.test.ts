/**
 * Tests for provider utility functions
 * Requirements: 4.1, 2.4
 */

import { describe, it, expect, vi } from 'vitest';
import {
  sleep,
  calculateBackoffDelay,
  retryWithBackoff,
  parseSSEData,
  validateApiKey,
  sanitizeUrl,
  extractErrorMessage,
  isRetryableError
} from '../utils';
import { ProviderError, NetworkError, TimeoutError } from '../errors';

describe('Provider Utils', () => {
  describe('sleep', () => {
    it('should return a promise that resolves', async () => {
      const result = await sleep(1); // Very short sleep
      expect(result).toBeUndefined();
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(calculateBackoffDelay(1, 1000)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000)).toBe(2000);
      expect(calculateBackoffDelay(3, 1000)).toBe(4000);
      expect(calculateBackoffDelay(4, 1000)).toBe(8000);
    });

    it('should cap delay at 30 seconds', () => {
      expect(calculateBackoffDelay(10, 1000)).toBe(30000);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, 3, 100, 'test-provider');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new NetworkError('test', 'Network error'))
        .mockResolvedValueOnce('success');
      
      const result = await retryWithBackoff(mockFn, 3, 10, 'test-provider');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new ProviderError('Auth error', 'test', 'AUTH', 401, false);
      const mockFn = vi.fn().mockRejectedValue(nonRetryableError);
      
      await expect(retryWithBackoff(mockFn, 3, 10, 'test-provider'))
        .rejects.toThrow(nonRetryableError);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw last error after max retries', async () => {
      const error = new NetworkError('test', 'Persistent error');
      const mockFn = vi.fn().mockRejectedValue(error);
      
      await expect(retryWithBackoff(mockFn, 2, 10, 'test-provider'))
        .rejects.toThrow(error);
      
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('parseSSEData', () => {
    it('should parse valid SSE data', () => {
      const sseData = `data: {"id":"1","content":"Hello"}
data: {"id":"2","content":"World"}
data: [DONE]`;
      
      const result = parseSSEData(sseData);
      
      expect(result).toEqual([
        { id: "1", content: "Hello" },
        { id: "2", content: "World" }
      ]);
    });

    it('should handle invalid JSON gracefully', () => {
      const sseData = `data: {"valid":"json"}
data: invalid json
data: {"another":"valid"}`;
      
      const result = parseSSEData(sseData);
      
      expect(result).toEqual([
        { valid: "json" },
        { another: "valid" }
      ]);
    });

    it('should stop at [DONE] marker', () => {
      const sseData = `data: {"before":"done"}
data: [DONE]
data: {"after":"done"}`;
      
      const result = parseSSEData(sseData);
      
      expect(result).toEqual([
        { before: "done" }
      ]);
    });
  });

  describe('validateApiKey', () => {
    it('should validate OpenAI API keys', () => {
      expect(validateApiKey('sk-' + 'a'.repeat(48), 'openai')).toBe(true);
      expect(validateApiKey('sk-short', 'openai')).toBe(false);
      expect(validateApiKey('invalid-format', 'openai')).toBe(false);
    });

    it('should validate Anthropic API keys', () => {
      expect(validateApiKey('sk-ant-' + 'a'.repeat(95), 'anthropic')).toBe(true);
      expect(validateApiKey('sk-ant-short', 'anthropic')).toBe(false);
    });

    it('should use generic validation for unknown providers', () => {
      expect(validateApiKey('a'.repeat(25), 'unknown')).toBe(true);
      expect(validateApiKey('short', 'unknown')).toBe(false);
    });

    it('should reject invalid inputs', () => {
      expect(validateApiKey('', 'openai')).toBe(false);
      expect(validateApiKey(null as any, 'openai')).toBe(false);
      expect(validateApiKey(undefined as any, 'openai')).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('should remove trailing slashes', () => {
      expect(sanitizeUrl('https://api.example.com/')).toBe('https://api.example.com');
      expect(sanitizeUrl('https://api.example.com///')).toBe('https://api.example.com');
    });

    it('should add https:// prefix if missing', () => {
      expect(sanitizeUrl('api.example.com')).toBe('https://api.example.com');
      expect(sanitizeUrl('localhost:8080')).toBe('https://localhost:8080');
    });

    it('should preserve existing protocol', () => {
      expect(sanitizeUrl('http://localhost:8080')).toBe('http://localhost:8080');
      expect(sanitizeUrl('https://api.example.com')).toBe('https://api.example.com');
    });

    it('should throw on empty URL', () => {
      expect(() => sanitizeUrl('')).toThrow('URL cannot be empty');
      expect(() => sanitizeUrl(null as any)).toThrow('URL cannot be empty');
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract message from string', () => {
      expect(extractErrorMessage('Simple error')).toBe('Simple error');
    });

    it('should extract message from error object', () => {
      expect(extractErrorMessage({ message: 'Error message' })).toBe('Error message');
    });

    it('should extract nested error message', () => {
      expect(extractErrorMessage({ error: { message: 'Nested error' } })).toBe('Nested error');
    });

    it('should extract detail field', () => {
      expect(extractErrorMessage({ detail: 'Detail message' })).toBe('Detail message');
    });

    it('should use default message for unknown format', () => {
      expect(extractErrorMessage({ unknown: 'field' })).toBe('Unknown error');
      expect(extractErrorMessage({ unknown: 'field' }, 'Custom default')).toBe('Custom default');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable provider errors', () => {
      expect(isRetryableError(new NetworkError('test', 'Network error'))).toBe(true);
      expect(isRetryableError(new TimeoutError('test', 30000))).toBe(true);
    });

    it('should identify retryable HTTP status codes', () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 504 })).toBe(true);
      expect(isRetryableError({ statusCode: 408 })).toBe(true);
    });

    it('should identify non-retryable HTTP status codes', () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 403 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
    });

    it('should identify retryable network error codes', () => {
      expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
      expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
      expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
    });

    it('should return false for unknown errors', () => {
      expect(isRetryableError({ unknown: 'error' })).toBe(false);
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
    });
  });
});