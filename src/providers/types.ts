/**
 * Provider-specific types and interfaces
 * Requirements: 4.1, 2.4
 */

import type { LLMRequest, LLMResponse } from '../types/chat';
import type { ProviderConfig } from '../types/providers';

/**
 * Base interface for all LLM providers
 * Requirements: 4.1
 */
export interface ILLMProvider {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly config: ProviderConfig;
  
  /**
   * Send a request to the LLM provider
   * Requirements: 2.4
   */
  sendRequest(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Send a streaming request to the LLM provider
   * Requirements: 2.4
   */
  sendStreamingRequest(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: LLMResponse) => void,
    onError: (error: Error) => void
  ): Promise<void>;
  
  /**
   * Validate the provider configuration
   * Requirements: 4.5
   */
  validateConfig(): Promise<ValidationResult>;
  
  /**
   * Test the connection to the provider
   * Requirements: 4.5
   */
  testConnection(): Promise<ConnectionTestResult>;
  
  /**
   * Get available models from the provider
   * Requirements: 4.1
   */
  getAvailableModels(): Promise<string[]>;
  
  /**
   * Check if the provider is healthy
   * Requirements: 4.5
   */
  healthCheck(): Promise<HealthCheckResult>;
}

/**
 * Configuration validation result
 * Requirements: 4.5
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Connection test result
 * Requirements: 4.5
 */
export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  availableModels?: string[];
}

/**
 * Health check result
 * Requirements: 4.5
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

/**
 * Rate limiting configuration
 * Requirements: 4.1
 */
export interface RateLimitConfig {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  requestsPerHour?: number;
  tokensPerHour?: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

/**
 * Rate limiting state
 * Requirements: 4.1
 */
export interface RateLimitState {
  requests: {
    count: number;
    resetTime: Date;
  };
  tokens: {
    count: number;
    resetTime: Date;
  };
}

/**
 * HTTP request options for API providers
 * Requirements: 4.1
 */
export interface HTTPRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * HTTP response from API providers
 * Requirements: 4.1
 */
export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
}

/**
 * Streaming response chunk
 * Requirements: 2.4
 */
export interface StreamingChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}