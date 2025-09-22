/**
 * API-based provider implementation for OpenAI, Anthropic, etc.
 * Requirements: 4.1, 4.4, 2.4
 */

import type { LLMRequest, LLMResponse } from '../../types/chat';
import type { APIProviderConfig } from '../../types/providers';
import type {
  ConnectionTestResult,
  RateLimitConfig,
  HTTPRequestOptions,
  HTTPResponse,
  StreamingChunk
} from '../types';
import { BaseProvider } from '../base/BaseProvider';
import {
  ProviderError,
  AuthenticationError,
  RateLimitError,
  QuotaExceededError,
  NetworkError,
  ModelNotFoundError,
  InvalidRequestError
} from '../errors';
import {
  validateApiKey,
  sanitizeUrl,
  extractErrorMessage,
  isRetryableError,
  parseSSEData
} from '../utils';

/**
 * API-based LLM provider implementation
 * Requirements: 4.1, 4.4, 2.4
 */
export class APIProvider extends BaseProvider {
  private readonly apiConfig: APIProviderConfig;

  constructor(
    id: string,
    name: string,
    config: APIProviderConfig
  ) {
    super(id, name, 'api', config);
    this.apiConfig = config;
  }

  /**
   * Send a request to the API provider
   * Requirements: 2.4
   */
  async sendRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Estimate token count for rate limiting
      const messageText = request.messages.map(m => m.content).join(' ');
      const estimatedTokens = this.estimateTokenCount(messageText);
      
      // Check rate limits
      await this.checkRateLimit(estimatedTokens);
      
      // Prepare the API request
      const apiRequest = this.prepareAPIRequest(request);
      
      // Execute the request with retry logic
      const response = await this.executeWithRetry(
        () => this.makeHTTPRequest(apiRequest),
        3,
        this.getTimeout()
      );
      
      // Parse and return the response
      return this.parseAPIResponse(response, startTime);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Send a streaming request to the API provider
   * Requirements: 2.4
   */
  async sendStreamingRequest(
    request: LLMRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: LLMResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Estimate token count for rate limiting
      const messageText = request.messages.map(m => m.content).join(' ');
      const estimatedTokens = this.estimateTokenCount(messageText);
      
      // Check rate limits
      await this.checkRateLimit(estimatedTokens);
      
      // Prepare the streaming API request
      const apiRequest = this.prepareAPIRequest(request, true);
      
      // Execute the streaming request
      await this.makeStreamingHTTPRequest(
        apiRequest,
        onChunk,
        (finalContent) => {
          const response: LLMResponse = {
            modelId: this.id,
            content: finalContent,
            metadata: {
              processingTime: Date.now() - startTime,
              finishReason: 'stop'
            }
          };
          onComplete(response);
        },
        (error) => onError(this.handleError(error))
      );
      
    } catch (error) {
      onError(this.handleError(error));
    }
  }

  /**
   * Get available models from the API provider
   * Requirements: 4.1
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const requestOptions: HTTPRequestOptions = {
        method: 'GET',
        url: `${this.apiConfig.baseUrl}/models`,
        headers: this.getHeaders(),
        timeout: this.getTimeout()
      };
      
      const response = await this.makeHTTPRequest(requestOptions);
      
      // Parse models from response (format varies by provider)
      return this.parseModelsResponse(response);
      
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Test the connection to the API provider
   * Requirements: 4.5
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      // Try to get available models as a connection test
      const models = await this.getAvailableModels();
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        latency,
        availableModels: models
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      
      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Get rate limit configuration for this provider
   * Requirements: 4.1
   */
  protected getRateLimitConfig(): RateLimitConfig | null {
    return {
      requestsPerMinute: this.apiConfig.rateLimitRpm,
      tokensPerMinute: this.apiConfig.rateLimitTpm
    };
  }

  /**
   * Prepare the API request payload
   * Requirements: 4.1, 3.1
   */
  private prepareAPIRequest(request: LLMRequest, stream: boolean = false): HTTPRequestOptions {
    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.name && { name: msg.name })
    }));

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: request.systemPrompt
      } as any);
    }

    const payload = {
      model: this.apiConfig.modelName,
      messages,
      max_tokens: request.maxTokens || this.getMaxTokens(),
      temperature: request.temperature ?? this.getTemperature(),
      top_p: this.getTopP(),
      stream,
      ...(request.metadata && {
        metadata: {
          conversation_id: request.metadata.conversationId,
          message_id: request.metadata.messageId
        }
      })
    };

    return {
      method: 'POST',
      url: `${this.apiConfig.baseUrl}/chat/completions`,
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: this.getTimeout()
    };
  }

  /**
   * Get HTTP headers for API requests
   * Requirements: 4.1
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiConfig.apiKey}`,
      'User-Agent': 'Multi-LLM-Chat/1.0.0'
    };

    // Add organization header if provided
    if (this.apiConfig.organization) {
      headers['OpenAI-Organization'] = this.apiConfig.organization;
    }

    // Add custom headers
    if (this.apiConfig.headers) {
      Object.assign(headers, this.apiConfig.headers);
    }

    return headers;
  }

  /**
   * Make an HTTP request using fetch
   * Requirements: 4.1, 2.4
   */
  private async makeHTTPRequest(options: HTTPRequestOptions): Promise<HTTPResponse> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
      
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      const data = await response.json();
      
      // Convert Headers to plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data,
        responseTime
      };
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new NetworkError(this.id, 'Request timeout', error);
      }
      
      throw new NetworkError(this.id, `Network request failed: ${error.message}`, error);
    }
  }

  /**
   * Make a streaming HTTP request
   * Requirements: 2.4
   */
  private async makeStreamingHTTPRequest(
    options: HTTPRequestOptions,
    onChunk: (chunk: string) => void,
    onComplete: (finalContent: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
      
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw this.createErrorFromResponse(response.status, errorData);
      }
      
      if (!response.body) {
        throw new NetworkError(this.id, 'No response body for streaming request');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalContent = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                onComplete(finalContent);
                return;
              }
              
              try {
                const parsed: StreamingChunk = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  finalContent += content;
                  onChunk(content);
                }
                
                if (parsed.choices?.[0]?.finish_reason) {
                  onComplete(finalContent);
                  return;
                }
              } catch (parseError) {
                // Skip invalid JSON chunks
                continue;
              }
            }
          }
        }
        
        onComplete(finalContent);
        
      } finally {
        reader.releaseLock();
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        onError(new NetworkError(this.id, 'Streaming request timeout', error));
      } else {
        onError(this.handleError(error));
      }
    }
  }

  /**
   * Parse API response into LLMResponse
   * Requirements: 2.4
   */
  private parseAPIResponse(response: HTTPResponse, startTime: number): LLMResponse {
    if (!response.data) {
      throw new InvalidRequestError(this.id, 'Empty response from API');
    }
    
    // Handle error responses
    if (response.status >= 400) {
      throw this.createErrorFromResponse(response.status, response.data);
    }
    
    const choice = response.data.choices?.[0];
    if (!choice) {
      throw new InvalidRequestError(this.id, 'No choices in API response');
    }
    
    return {
      modelId: this.id,
      content: choice.message?.content || '',
      metadata: {
        processingTime: Date.now() - startTime,
        tokenCount: response.data.usage?.total_tokens,
        finishReason: choice.finish_reason
      },
      usage: {
        promptTokens: response.data.usage?.prompt_tokens,
        completionTokens: response.data.usage?.completion_tokens,
        totalTokens: response.data.usage?.total_tokens
      }
    };
  }

  /**
   * Parse models response from API
   * Requirements: 4.1
   */
  private parseModelsResponse(response: HTTPResponse): string[] {
    if (!response.data?.data) {
      return [this.apiConfig.modelName]; // Fallback to configured model
    }
    
    return response.data.data
      .map((model: any) => model.id)
      .filter((id: string) => typeof id === 'string');
  }

  /**
   * Create appropriate error from API response
   * Requirements: 2.4
   */
  private createErrorFromResponse(status: number, data: any): ProviderError {
    const message = extractErrorMessage(data, 'API request failed');
    
    switch (status) {
      case 401:
        return new AuthenticationError(this.id, message);
      case 404:
        return new ModelNotFoundError(this.id, this.apiConfig.modelName);
      case 429:
        const retryAfter = data.retry_after || 60;
        if (message.toLowerCase().includes('quota')) {
          return new QuotaExceededError(this.id, message);
        }
        return new RateLimitError(this.id, message, retryAfter);
      case 400:
        return new InvalidRequestError(this.id, message);
      default:
        return new ProviderError(
          message,
          this.id,
          `HTTP_${status}`,
          status,
          isRetryableError({ status })
        );
    }
  }

  /**
   * Handle and transform errors
   * Requirements: 2.4
   */
  private handleError(error: any): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }
    
    if (error.name === 'AbortError') {
      return new NetworkError(this.id, 'Request timeout', error);
    }
    
    return new NetworkError(
      this.id,
      `Unexpected error: ${error.message || 'Unknown error'}`,
      error
    );
  }
}