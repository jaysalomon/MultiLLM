/**
 * Utility functions for provider implementations
 * Requirements: 4.1, 2.4
 */

import { ProviderError, NetworkError, TimeoutError } from './errors';

/**
 * Sleep for a specified number of milliseconds
 * Requirements: 2.4
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay calculation
 * Requirements: 2.4
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
}

/**
 * Retry a function with exponential backoff
 * Requirements: 2.4
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  providerId: string = 'unknown'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on non-retryable errors
      if (error instanceof ProviderError && !error.retryable) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt > maxRetries) {
        break;
      }
      
      const delay = calculateBackoffDelay(attempt, baseDelay);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 * Requirements: 2.4
 */
export function createTimeoutPromise(timeoutMs: number, providerId: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(providerId, timeoutMs));
    }, timeoutMs);
  });
}

/**
 * Race a promise against a timeout
 * Requirements: 2.4
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  providerId: string
): Promise<T> {
  return Promise.race([
    promise,
    createTimeoutPromise(timeoutMs, providerId)
  ]);
}

/**
 * Parse Server-Sent Events (SSE) data
 * Requirements: 2.4
 */
export function parseSSEData(data: string): any[] {
  const lines = data.split('\n');
  const events: any[] = [];
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonData = line.slice(6).trim();
      if (jsonData === '[DONE]') {
        break;
      }
      
      try {
        const parsed = JSON.parse(jsonData);
        events.push(parsed);
      } catch (error) {
        // Skip invalid JSON lines
        continue;
      }
    }
  }
  
  return events;
}

/**
 * Validate API key format
 * Requirements: 4.1
 */
export function validateApiKey(apiKey: string, provider: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Basic validation patterns for common providers
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-]{95,}$/,
    cohere: /^[a-zA-Z0-9]{40,}$/,
  };
  
  const pattern = patterns[provider.toLowerCase()];
  if (pattern) {
    return pattern.test(apiKey);
  }
  
  // Generic validation - at least 20 characters
  return apiKey.length >= 20;
}

/**
 * Sanitize URL by removing trailing slashes and ensuring proper format
 * Requirements: 4.1
 */
export function sanitizeUrl(url: string): string {
  if (!url) {
    throw new Error('URL cannot be empty');
  }
  
  // Remove trailing slashes
  let sanitized = url.replace(/\/+$/, '');
  
  // Ensure it starts with http:// or https://
  if (!sanitized.match(/^https?:\/\//)) {
    sanitized = `https://${sanitized}`;
  }
  
  return sanitized;
}

/**
 * Extract error message from various error response formats
 * Requirements: 2.4
 */
export function extractErrorMessage(error: any, defaultMessage: string = 'Unknown error'): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error?.message) {
    return error.error.message;
  }
  
  if (error?.detail) {
    return error.detail;
  }
  
  if (error?.details) {
    return error.details;
  }
  
  return defaultMessage;
}

/**
 * Check if an error is retryable based on status code or error type
 * Requirements: 2.4
 */
export function isRetryableError(error: any): boolean {
  // Network errors are generally retryable
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }
  
  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  if (error?.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  if (error?.statusCode && retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }
  
  // Check for specific error codes
  const retryableErrorCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
  
  if (error?.code && retryableErrorCodes.includes(error.code)) {
    return true;
  }
  
  return false;
}