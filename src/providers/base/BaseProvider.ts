/**
 * Base provider class with common functionality
 * Requirements: 4.1, 2.4, 4.5
 */

import type { LLMRequest, LLMResponse } from '../../types/chat';
import type { ProviderConfig } from '../../types/providers';
import type {
  ILLMProvider,
  ValidationResult,
  ConnectionTestResult,
  HealthCheckResult,
  RateLimitConfig,
  RateLimitState
} from '../types';
import { ProviderError, RateLimitError } from '../errors';
import { retryWithBackoff, withTimeout } from '../utils';

/**
 * Abstract base class for all LLM providers
 * Requirements: 4.1, 2.4
 */
export abstract class BaseProvider implements ILLMProvider {
  protected rateLimitState: Map<string, RateLimitState> = new Map();
  protected lastHealthCheck?: HealthCheckResult;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: string,
    public readonly config: ProviderConfig
  ) {}

  /**
   * Abstract method to send a request - must be implemented by subclasses
   * Requirements: 2.4
   */
  abstract sendRequest(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Abstract method to send a streaming request - must be implemented by subclasses
   * Requirements: 2.4
   */
  abstract sendStreamingRequest(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: LLMResponse) => void,
    onError: (error: Error) => void
  ): Promise<void>;

  /**
   * Abstract method to get available models - must be implemented by subclasses
   * Requirements: 4.1
   */
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * Abstract method to test connection - must be implemented by subclasses
   * Requirements: 4.5
   */
  abstract testConnection(): Promise<ConnectionTestResult>;

  /**
   * Validate the provider configuration
   * Requirements: 4.5
   */
  async validateConfig(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!this.config.displayName?.trim()) {
      errors.push('Display name is required');
    }

    if (this.config.timeout && this.config.timeout < 1000) {
      warnings.push('Timeout is very low (< 1 second)');
    }

    if (this.config.maxTokens && this.config.maxTokens < 1) {
      errors.push('Max tokens must be greater than 0');
    }

    if (this.config.temperature !== undefined) {
      if (this.config.temperature < 0 || this.config.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    if (this.config.topP !== undefined) {
      if (this.config.topP < 0 || this.config.topP > 1) {
        errors.push('Top P must be between 0 and 1');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform a health check on the provider
   * Requirements: 4.5
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const connectionResult = await this.testConnection();
      const latency = Date.now() - startTime;
      
      this.lastHealthCheck = {
        healthy: connectionResult.success,
        latency,
        error: connectionResult.error,
        lastChecked: new Date()
      };
      
      return this.lastHealthCheck;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      this.lastHealthCheck = {
        healthy: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
      
      return this.lastHealthCheck;
    }
  }

  /**
   * Get the last health check result
   * Requirements: 4.5
   */
  getLastHealthCheck(): HealthCheckResult | undefined {
    return this.lastHealthCheck;
  }

  /**
   * Check rate limits before making a request
   * Requirements: 4.1
   */
  protected async checkRateLimit(estimatedTokens: number = 0): Promise<void> {
    const rateLimitConfig = this.getRateLimitConfig();
    if (!rateLimitConfig) {
      return; // No rate limiting configured
    }

    const now = new Date();
    const state = this.rateLimitState.get(this.id) || {
      requests: { count: 0, resetTime: now },
      tokens: { count: 0, resetTime: now }
    };

    // Reset counters if time window has passed
    if (now >= state.requests.resetTime) {
      state.requests.count = 0;
      state.requests.resetTime = new Date(now.getTime() + 60000); // 1 minute
    }

    if (now >= state.tokens.resetTime) {
      state.tokens.count = 0;
      state.tokens.resetTime = new Date(now.getTime() + 60000); // 1 minute
    }

    // Check request rate limit
    if (rateLimitConfig.requestsPerMinute && 
        state.requests.count >= rateLimitConfig.requestsPerMinute) {
      const retryAfter = Math.ceil((state.requests.resetTime.getTime() - now.getTime()) / 1000);
      throw new RateLimitError(
        this.id,
        `Request rate limit exceeded (${rateLimitConfig.requestsPerMinute}/min)`,
        retryAfter
      );
    }

    // Check token rate limit
    if (rateLimitConfig.tokensPerMinute && 
        state.tokens.count + estimatedTokens > rateLimitConfig.tokensPerMinute) {
      const retryAfter = Math.ceil((state.tokens.resetTime.getTime() - now.getTime()) / 1000);
      throw new RateLimitError(
        this.id,
        `Token rate limit exceeded (${rateLimitConfig.tokensPerMinute}/min)`,
        retryAfter
      );
    }

    // Update counters
    state.requests.count++;
    state.tokens.count += estimatedTokens;
    this.rateLimitState.set(this.id, state);
  }

  /**
   * Get rate limit configuration - can be overridden by subclasses
   * Requirements: 4.1
   */
  protected getRateLimitConfig(): RateLimitConfig | null {
    return null; // No rate limiting by default
  }

  /**
   * Execute a request with retry logic and timeout
   * Requirements: 2.4
   */
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs || this.config.timeout || 30000;
    
    return retryWithBackoff(
      async () => {
        return withTimeout(fn(), timeout, this.id);
      },
      maxRetries,
      1000,
      this.id
    );
  }

  /**
   * Estimate token count for rate limiting (rough approximation)
   * Requirements: 4.1
   */
  protected estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get timeout value from config with fallback
   * Requirements: 2.4
   */
  protected getTimeout(): number {
    return this.config.timeout || 30000;
  }

  /**
   * Get max tokens from config with fallback
   * Requirements: 4.1
   */
  protected getMaxTokens(): number {
    return this.config.maxTokens || 4096;
  }

  /**
   * Get temperature from config with fallback
   * Requirements: 4.1
   */
  protected getTemperature(): number {
    return this.config.temperature ?? 0.7;
  }

  /**
   * Get top P from config with fallback
   * Requirements: 4.1
   */
  protected getTopP(): number {
    return this.config.topP ?? 1.0;
  }
}