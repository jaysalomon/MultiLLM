/**
 * LM Studio provider implementation for local LLM instances
 * Requirements: 4.3, 4.4, 2.4
 */

import { BaseProvider } from '../base/BaseProvider';
import type { 
  LLMRequest
} from '../../types/providers';
import type { LLMResponse } from '../../types/chat';
import type {
  ValidationResult,
  ConnectionTestResult,
  RateLimitConfig
} from '../types';
import {
  ProviderError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError,
  InvalidRequestError,
  AuthenticationError
} from '../errors';
import { withTimeout, extractErrorMessage } from '../utils';
import type { LMStudioProviderConfig } from '../../types/providers';

/**
 * LM Studio-specific response interfaces
 */
interface LMStudioModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface LMStudioModelsResponse {
  object: string;
  data: LMStudioModel[];
}

interface LMStudioChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
}

interface LMStudioChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LMStudioStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}

/**
 * LM Studio provider for local LLM instances using OpenAI-compatible API
 * Requirements: 4.3, 4.4, 2.4
 */
export class LMStudioProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly apiKey?: string;

  constructor(
    id: string,
    name: string,
    config: LMStudioProviderConfig
  ) {
    super(id, name, 'lmstudio', config);
    
    this.baseUrl = config.host.replace(/\/$/, ''); // Remove trailing slash
    this.modelName = config.modelName;
    this.apiKey = config.apiKey;
  }

  /**
   * Send a request to LM Studio
   * Requirements: 2.4
   */
  async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      const estimatedTokens = this.estimateTokenCount(
        request.messages.map(m => m.content).join(' ')
      );
      await this.checkRateLimit(estimatedTokens);

      const lmStudioRequest: LMStudioChatRequest = {
        model: this.modelName,
        messages: request.messages,
        temperature: request.temperature ?? this.getTemperature(),
        max_tokens: request.maxTokens ?? this.getMaxTokens(),
        top_p: this.getTopP(),
        stream: false,
        stop: ['Human:', 'User:', '\n\nHuman:', '\n\nUser:']
      };

      const response = await this.makeRequest<LMStudioChatResponse>(
        '/v1/chat/completions',
        'POST',
        lmStudioRequest
      );

      const processingTime = Date.now() - startTime;

      if (!response.choices || response.choices.length === 0) {
        throw new ProviderError(
          'No response choices returned from LM Studio',
          this.id,
          'NO_CHOICES',
          undefined,
          false
        );
      }

      const choice = response.choices[0];
      
      return {
        modelId: this.id,
        content: choice.message.content.trim(),
        metadata: {
          processingTime,
          tokenCount: response.usage?.total_tokens,
          finishReason: choice.finish_reason as any
        },
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens
        }
      };

    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
      throw new ProviderError(
        `LM Studio request failed: ${extractErrorMessage(error)}`,
        this.id,
        'REQUEST_FAILED',
        undefined,
        true
      );
    }
  }

  /**
   * Send a streaming request to LM Studio
   * Requirements: 2.4
   */
  async sendStreamingRequest(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: LLMResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const startTime = Date.now();
    let fullResponse = '';
    let tokenCount = 0;

    try {
      // Check rate limits
      const estimatedTokens = this.estimateTokenCount(
        request.messages.map(m => m.content).join(' ')
      );
      await this.checkRateLimit(estimatedTokens);

      const lmStudioRequest: LMStudioChatRequest = {
        model: this.modelName,
        messages: request.messages,
        temperature: request.temperature ?? this.getTemperature(),
        max_tokens: request.maxTokens ?? this.getMaxTokens(),
        top_p: this.getTopP(),
        stream: true,
        stop: ['Human:', 'User:', '\n\nHuman:', '\n\nUser:']
      };

      let completed = false;
      
      await this.makeStreamingRequest(
        '/v1/chat/completions',
        lmStudioRequest,
        (chunk: LMStudioStreamChunk) => {
          if (chunk.choices && chunk.choices.length > 0) {
            const choice = chunk.choices[0];
            if (choice.delta?.content) {
              fullResponse += choice.delta.content;
              onChunk(choice.delta.content);
            }
            
            if (choice.finish_reason && !completed) {
              completed = true;
              const processingTime = Date.now() - startTime;
              onComplete({
                modelId: this.id,
                content: fullResponse.trim(),
                metadata: {
                  processingTime,
                  tokenCount,
                  finishReason: choice.finish_reason as any
                }
              });
            }
          }
        }
      );
      
      // Ensure completion is called even if no finish_reason was received
      if (!completed) {
        const processingTime = Date.now() - startTime;
        onComplete({
          modelId: this.id,
          content: fullResponse.trim(),
          metadata: {
            processingTime,
            tokenCount,
            finishReason: 'stop'
          }
        });
      }

    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown streaming error'));
    }
  }

  /**
   * Get available models from LM Studio
   * Requirements: 4.3
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest<LMStudioModelsResponse>('/v1/models', 'GET');
      return response.data.map(model => model.id);
    } catch (error) {
      throw new ProviderError(
        `Failed to get available models: ${extractErrorMessage(error)}`,
        this.id,
        'MODEL_LIST_FAILED',
        undefined,
        true
      );
    }
  }

  /**
   * Test connection to LM Studio instance
   * Requirements: 4.5
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      // First, check if LM Studio is running by getting models
      const response = await this.makeRequest<LMStudioModelsResponse>('/v1/models', 'GET');
      const latency = Date.now() - startTime;
      
      const availableModels = response.data.map(model => model.id);
      
      // Check if our configured model is available
      if (!availableModels.includes(this.modelName)) {
        return {
          success: false,
          latency,
          error: `Model '${this.modelName}' not found. Available models: ${availableModels.join(', ')}`,
          availableModels
        };
      }
      
      return {
        success: true,
        latency,
        availableModels
      };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      
      return {
        success: false,
        latency,
        error: extractErrorMessage(error, 'Failed to connect to LM Studio')
      };
    }
  }

  /**
   * Validate LM Studio provider configuration
   * Requirements: 4.5
   */
  async validateConfig(): Promise<ValidationResult> {
    const baseValidation = await super.validateConfig();
    const errors = [...baseValidation.errors];
    const warnings = [...baseValidation.warnings];
    
    const config = this.config as LMStudioProviderConfig;
    
    // Validate host URL
    if (!config.host?.trim()) {
      errors.push('LM Studio host URL is required');
    } else {
      try {
        const url = new URL(config.host);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push('LM Studio host must use HTTP or HTTPS protocol');
        }
      } catch {
        errors.push('Invalid LM Studio host URL format');
      }
    }
    
    // Validate model name
    if (!config.modelName?.trim()) {
      errors.push('Model name is required');
    }
    
    // Validate API key format if provided
    if (config.apiKey && config.apiKey.trim().length < 10) {
      warnings.push('API key seems too short (LM Studio typically doesn\'t require API keys for local usage)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get rate limit configuration for LM Studio
   * Requirements: 4.1
   */
  protected getRateLimitConfig(): RateLimitConfig | null {
    // LM Studio typically doesn't have strict rate limits, but we can set reasonable defaults
    return {
      requestsPerMinute: 120, // Higher than Ollama since it's typically more performant
      tokensPerMinute: 20000 // Conservative default
    };
  }

  /**
   * Make HTTP request to LM Studio API
   * Requirements: 2.4
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = this.getTimeout();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Add API key if provided
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return withTimeout(
      fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      }).then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 401) {
            throw new AuthenticationError(this.id, 'Invalid API key or authentication failed');
          }
          
          if (response.status === 404) {
            if (endpoint.includes('/v1/models')) {
              throw new ProviderError(
                'LM Studio models endpoint not found. Make sure LM Studio is running and the server is started.',
                this.id,
                'ENDPOINT_NOT_FOUND',
                404,
                false
              );
            }
            
            if (endpoint.includes('/v1/chat/completions')) {
              throw new ModelNotFoundError(this.id, this.modelName);
            }
            
            throw new ProviderError(
              `LM Studio endpoint not found: ${endpoint}`,
              this.id,
              'ENDPOINT_NOT_FOUND',
              404,
              false
            );
          }
          
          if (response.status >= 500) {
            throw new NetworkError(
              this.id,
              `LM Studio server error (${response.status}): ${errorText}`
            );
          }
          
          throw new InvalidRequestError(
            this.id,
            `LM Studio request failed (${response.status}): ${errorText}`
          );
        }
        
        return response.json();
      }).catch((error) => {
        if (error instanceof ProviderError) {
          throw error;
        }
        
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new TimeoutError(this.id, timeout);
        }
        
        throw new NetworkError(
          this.id,
          `Failed to connect to LM Studio at ${this.baseUrl}: ${error.message}`,
          error
        );
      }),
      timeout,
      this.id
    );
  }

  /**
   * Make streaming request to LM Studio API
   * Requirements: 2.4
   */
  private async makeStreamingRequest(
    endpoint: string,
    body: any,
    onChunk: (chunk: LMStudioStreamChunk) => void
  ): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = this.getTimeout();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };

    // Add API key if provided
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return withTimeout(
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }).then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new ProviderError(
            `LM Studio streaming request failed (${response.status}): ${errorText}`,
            this.id,
            'STREAMING_FAILED',
            response.status,
            true
          );
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new ProviderError(
            'No response body available for streaming',
            this.id,
            'NO_STREAM_BODY',
            undefined,
            false
          );
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = line.trim().slice(6);
                
                if (data === '[DONE]') {
                  return;
                }
                
                try {
                  const chunk = JSON.parse(data) as LMStudioStreamChunk;
                  onChunk(chunk);
                } catch (parseError) {
                  console.warn('Failed to parse LM Studio stream chunk:', data);
                }
              }
            }
          }
          
          // Process any remaining buffer
          if (buffer.trim().startsWith('data: ')) {
            const data = buffer.trim().slice(6);
            if (data !== '[DONE]') {
              try {
                const chunk = JSON.parse(data) as LMStudioStreamChunk;
                onChunk(chunk);
              } catch (parseError) {
                console.warn('Failed to parse final LM Studio stream chunk:', data);
              }
            }
          }
          
        } finally {
          reader.releaseLock();
        }
      }).catch((error) => {
        if (error instanceof ProviderError) {
          throw error;
        }
        
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw new TimeoutError(this.id, timeout);
        }
        
        throw new NetworkError(
          this.id,
          `LM Studio streaming failed: ${error.message}`,
          error
        );
      }),
      timeout,
      this.id
    );
  }
}