/**
 * Ollama provider implementation for local LLM instances
 * Requirements: 4.2, 4.4, 2.4
 */

import { BaseProvider } from '../base/BaseProvider';
import type { 
  LLMRequest, 
  LLMResponse, 
  OllamaProviderConfig 
} from '../../types';
import type {
  ValidationResult,
  ConnectionTestResult,
  HealthCheckResult,
  RateLimitConfig
} from '../types';
import {
  ProviderError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError,
  InvalidRequestError
} from '../errors';
import { withTimeout } from '../utils';

/**
 * Ollama-specific response interfaces
 */
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaListResponse {
  models: OllamaModel[];
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_ctx?: number;
    num_gpu?: number;
    num_thread?: number;
    repeat_penalty?: number;
    seed?: number;
    stop?: string[];
  };
  keep_alive?: string;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

/**
 * Ollama provider for local LLM instances
 * Requirements: 4.2, 4.4, 2.4
 */
export class OllamaProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly keepAlive: string;
  private readonly numCtx?: number;
  private readonly numGpu?: number;

  constructor(
    id: string,
    name: string,
    config: OllamaProviderConfig
  ) {
    super(id, name, 'ollama', config);
    
    this.baseUrl = config.host.replace(/\/$/, ''); // Remove trailing slash
    this.modelName = config.modelName;
    this.keepAlive = config.keepAlive || '5m';
    this.numCtx = config.numCtx;
    this.numGpu = config.numGpu;
  }

  /**
   * Send a request to Ollama
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

      // Convert messages to Ollama format
      const { prompt, systemPrompt } = this.convertMessagesToPrompt(request.messages);
      
      const ollamaRequest: OllamaGenerateRequest = {
        model: this.modelName,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: request.temperature ?? this.getTemperature(),
          top_p: this.getTopP(),
          num_ctx: this.numCtx,
          num_gpu: this.numGpu,
          stop: ['Human:', 'User:', '\n\nHuman:', '\n\nUser:']
        },
        keep_alive: this.keepAlive
      };

      const response = await this.makeRequest<OllamaGenerateResponse>(
        '/api/generate',
        'POST',
        ollamaRequest
      );

      const processingTime = Date.now() - startTime;

      return {
        modelId: this.id,
        content: response.response.trim(),
        metadata: {
          processingTime,
          tokenCount: response.eval_count,
          finishReason: response.done ? 'stop' : undefined
        },
        usage: {
          promptTokens: response.prompt_eval_count,
          completionTokens: response.eval_count,
          totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (error instanceof ProviderError) {
        throw error;
      }
      
      throw new ProviderError(
        `Ollama request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.id,
        'REQUEST_FAILED',
        undefined,
        true
      );
    }
  }

  /**
   * Send a streaming request to Ollama
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

      // Convert messages to Ollama format
      const { prompt, systemPrompt } = this.convertMessagesToPrompt(request.messages);
      
      const ollamaRequest: OllamaGenerateRequest = {
        model: this.modelName,
        prompt,
        system: systemPrompt,
        stream: true,
        options: {
          temperature: request.temperature ?? this.getTemperature(),
          top_p: this.getTopP(),
          num_ctx: this.numCtx,
          num_gpu: this.numGpu,
          stop: ['Human:', 'User:', '\n\nHuman:', '\n\nUser:']
        },
        keep_alive: this.keepAlive
      };

      await this.makeStreamingRequest(
        '/api/generate',
        ollamaRequest,
        (chunk: OllamaStreamChunk) => {
          if (chunk.response) {
            fullResponse += chunk.response;
            onChunk(chunk.response);
          }
          
          if (chunk.done) {
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
        }
      );

    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown streaming error'));
    }
  }

  /**
   * Get available models from Ollama
   * Requirements: 4.2
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest<OllamaListResponse>('/api/tags', 'GET');
      return response.models.map(model => model.name);
    } catch (error) {
      throw new ProviderError(
        `Failed to get available models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.id,
        'MODEL_LIST_FAILED',
        undefined,
        true
      );
    }
  }

  /**
   * Test connection to Ollama instance
   * Requirements: 4.5
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      // First, check if Ollama is running
      const response = await this.makeRequest<OllamaListResponse>('/api/tags', 'GET');
      const latency = Date.now() - startTime;
      
      const availableModels = response.models.map(model => model.name);
      
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
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  /**
   * Validate Ollama provider configuration
   * Requirements: 4.5
   */
  async validateConfig(): Promise<ValidationResult> {
    const baseValidation = await super.validateConfig();
    const errors = [...baseValidation.errors];
    const warnings = [...baseValidation.warnings];
    
    const config = this.config as OllamaProviderConfig;
    
    // Validate host URL
    if (!config.host?.trim()) {
      errors.push('Ollama host URL is required');
    } else {
      try {
        new URL(config.host);
      } catch {
        errors.push('Invalid Ollama host URL format');
      }
    }
    
    // Validate model name
    if (!config.modelName?.trim()) {
      errors.push('Model name is required');
    }
    
    // Validate optional parameters
    if (config.numCtx !== undefined && config.numCtx < 1) {
      errors.push('Context window size must be greater than 0');
    }
    
    if (config.numGpu !== undefined && config.numGpu < 0) {
      errors.push('Number of GPU layers cannot be negative');
    }
    
    // Validate keep alive format
    if (config.keepAlive && !this.isValidKeepAlive(config.keepAlive)) {
      warnings.push('Invalid keep_alive format. Use formats like "5m", "1h", or "-1" for indefinite');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get rate limit configuration for Ollama
   * Requirements: 4.1
   */
  protected getRateLimitConfig(): RateLimitConfig | null {
    // Ollama typically doesn't have strict rate limits, but we can set reasonable defaults
    return {
      requestsPerMinute: 60, // Conservative default
      tokensPerMinute: 10000 // Conservative default
    };
  }

  /**
   * Convert chat messages to Ollama prompt format
   * Requirements: 3.1
   */
  private convertMessagesToPrompt(messages: LLMRequest['messages']): { prompt: string; systemPrompt?: string } {
    let systemPrompt: string | undefined;
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        const modelName = message.name || 'Assistant';
        prompt += `${modelName}: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    
    return { prompt, systemPrompt };
  }

  /**
   * Make HTTP request to Ollama API
   * Requirements: 2.4
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = this.getTimeout();
    
    return withTimeout(
      fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      }).then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 404) {
            if (endpoint.includes('/api/generate')) {
              throw new ModelNotFoundError(this.id, this.modelName);
            }
            throw new ProviderError(
              `Ollama endpoint not found: ${endpoint}`,
              this.id,
              'ENDPOINT_NOT_FOUND',
              404,
              false
            );
          }
          
          if (response.status >= 500) {
            throw new NetworkError(
              this.id,
              `Ollama server error (${response.status}): ${errorText}`
            );
          }
          
          throw new InvalidRequestError(
            this.id,
            `Ollama request failed (${response.status}): ${errorText}`
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
          `Failed to connect to Ollama at ${this.baseUrl}: ${error.message}`,
          error
        );
      }),
      timeout,
      this.id
    );
  }

  /**
   * Make streaming request to Ollama API
   * Requirements: 2.4
   */
  private async makeStreamingRequest(
    endpoint: string,
    body: any,
    onChunk: (chunk: OllamaStreamChunk) => void
  ): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = this.getTimeout();
    
    return withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      }).then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new ProviderError(
            `Ollama streaming request failed (${response.status}): ${errorText}`,
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
              if (line.trim()) {
                try {
                  const chunk = JSON.parse(line) as OllamaStreamChunk;
                  onChunk(chunk);
                } catch (parseError) {
                  console.warn('Failed to parse Ollama stream chunk:', line);
                }
              }
            }
          }
          
          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const chunk = JSON.parse(buffer) as OllamaStreamChunk;
              onChunk(chunk);
            } catch (parseError) {
              console.warn('Failed to parse final Ollama stream chunk:', buffer);
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
          `Ollama streaming failed: ${error.message}`,
          error
        );
      }),
      timeout,
      this.id
    );
  }

  /**
   * Validate keep_alive format
   * Requirements: 4.2
   */
  private isValidKeepAlive(keepAlive: string): boolean {
    // Valid formats: "5m", "1h", "30s", "-1" (indefinite), "0" (unload immediately)
    return /^(-1|0|\d+[smh])$/.test(keepAlive);
  }
}