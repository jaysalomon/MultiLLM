/**
 * Tests for API Provider implementation
 * Requirements: 4.1, 4.4, 2.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIProvider } from '../api/APIProvider';
import type { APIProviderConfig, LLMRequest } from '../../types';
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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('APIProvider', () => {
  let provider: APIProvider;
  let config: APIProviderConfig;

  beforeEach(() => {
    config = {
      displayName: 'OpenAI GPT-4',
      apiKey: 'sk-test123456789012345678901234567890123456789012345678',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7,
      organization: 'org-test',
      rateLimitRpm: 60,
      rateLimitTpm: 90000,
      timeout: 30000
    };

    provider = new APIProvider('test-provider', 'Test Provider', config);
    
    // Reset mocks
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create provider with correct properties', () => {
      expect(provider.id).toBe('test-provider');
      expect(provider.name).toBe('Test Provider');
      expect(provider.type).toBe('api');
      expect(provider.config).toBe(config);
    });
  });

  describe('sendRequest', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test-provider',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      temperature: 0.7,
      maxTokens: 1000
    };

    it('should send successful request and return response', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'I am doing well, thank you!' },
            finish_reason: 'stop'
          }
        ],
        usage: { total_tokens: 25 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const response = await provider.sendRequest(mockRequest);

      expect(response.modelId).toBe('test-provider');
      expect(response.content).toBe('I am doing well, thank you!');
      expect(response.metadata.tokenCount).toBe(25);
      expect(response.metadata.finishReason).toBe('stop');
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test123456789012345678901234567890123456789012345678',
            'Content-Type': 'application/json',
            'OpenAI-Organization': 'org-test'
          }),
          body: expect.stringContaining('"model":"gpt-4"')
        })
      );
    });

    it('should include system prompt when provided', async () => {
      const requestWithSystem: LLMRequest = {
        ...mockRequest,
        systemPrompt: 'You are a helpful assistant.'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
          usage: { total_tokens: 10 }
        })
      });

      await provider.sendRequest(requestWithSystem);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    });

    it('should handle authentication error (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({
          error: { message: 'Invalid API key' }
        })
      });

      await expect(provider.sendRequest(mockRequest))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle rate limit error (429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
        json: () => Promise.resolve({
          error: { message: 'Rate limit exceeded' },
          retry_after: 60
        })
      });

      await expect(provider.sendRequest(mockRequest))
        .rejects.toThrow(RateLimitError);
    });

    it('should handle quota exceeded error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
        json: () => Promise.resolve({
          error: { message: 'You have exceeded your quota' }
        })
      });

      await expect(provider.sendRequest(mockRequest))
        .rejects.toThrow(QuotaExceededError);
    });

    it('should handle model not found error (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        json: () => Promise.resolve({
          error: { message: 'Model not found' }
        })
      });

      await expect(provider.sendRequest(mockRequest))
        .rejects.toThrow(ModelNotFoundError);
    });

    it('should handle invalid request error (400)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: () => Promise.resolve({
          error: { message: 'Invalid request format' }
        })
      });

      await expect(provider.sendRequest(mockRequest))
        .rejects.toThrow(InvalidRequestError);
    });

    it('should handle network timeout', async () => {
      // Mock AbortController timeout
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      });

      await expect(provider.sendRequest(mockRequest))
        .rejects.toThrow(NetworkError);
    }, 10000); // Increase timeout for this test

    it('should retry on retryable errors', async () => {
      // First call fails with network error, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Success!' }, finish_reason: 'stop' }],
            usage: { total_tokens: 5 }
          })
        });

      const response = await provider.sendRequest(mockRequest);
      
      expect(response.content).toBe('Success!');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendStreamingRequest', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test-provider',
      messages: [{ role: 'user', content: 'Tell me a story' }]
    };

    it('should handle streaming response', async () => {
      const chunks: string[] = [];
      let finalResponse: any;
      let errorOccurred: any;

      // Mock streaming response
      const streamData = [
        'data: {"choices":[{"delta":{"content":"Once"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" upon"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" a time"}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n'
      ].join('');

      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/event-stream']]),
        body: mockReadableStream
      });

      await provider.sendStreamingRequest(
        mockRequest,
        (chunk) => chunks.push(chunk),
        (response) => { finalResponse = response; },
        (error) => { errorOccurred = error; }
      );

      expect(chunks).toEqual(['Once', ' upon', ' a time']);
      expect(finalResponse.content).toBe('Once upon a time');
      expect(finalResponse.modelId).toBe('test-provider');
      expect(errorOccurred).toBeUndefined();
    });

    it('should handle streaming errors', async () => {
      let errorOccurred: any;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      });

      await provider.sendStreamingRequest(
        mockRequest,
        () => {},
        () => {},
        (error) => { errorOccurred = error; }
      );

      expect(errorOccurred).toBeInstanceOf(AuthenticationError);
    });
  });

  describe('getAvailableModels', () => {
    it('should fetch and return available models', async () => {
      const mockModelsResponse = {
        data: [
          { id: 'gpt-4', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve(mockModelsResponse)
      });

      const models = await provider.getAvailableModels();

      expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test123456789012345678901234567890123456789012345678'
          })
        })
      );
    });

    it('should return configured model as fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({ data: null })
      });

      const models = await provider.getAvailableModels();

      expect(models).toEqual(['gpt-4']);
    });
  });

  describe('testConnection', () => {
    it('should return success when connection works', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({
          data: [{ id: 'gpt-4' }]
        })
      });

      const result = await provider.testConnection();

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.availableModels).toEqual(['gpt-4']);
      expect(result.error).toBeUndefined();
    });

    it('should return failure when connection fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.testConnection();

      expect(result.success).toBe(false);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toContain('Network error');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', async () => {
      const result = await provider.validateConfig();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing display name', async () => {
      const invalidConfig = { ...config, displayName: '' };
      const invalidProvider = new APIProvider('test', 'Test', invalidConfig);

      const result = await invalidProvider.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Display name is required');
    });

    it('should detect invalid temperature', async () => {
      const invalidConfig = { ...config, temperature: 3.0 };
      const invalidProvider = new APIProvider('test', 'Test', invalidConfig);

      const result = await invalidProvider.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Temperature must be between 0 and 2');
    });

    it('should detect invalid max tokens', async () => {
      const invalidConfig = { ...config, maxTokens: -1 };
      const invalidProvider = new APIProvider('test', 'Test', invalidConfig);

      const result = await invalidProvider.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max tokens must be greater than 0');
    });

    it('should warn about low timeout', async () => {
      const warningConfig = { ...config, timeout: 500 };
      const warningProvider = new APIProvider('test', 'Test', warningConfig);

      const result = await warningProvider.validateConfig();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Timeout is very low (< 1 second)');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when connection works', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({ data: [] })
      });

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect(result.lastChecked).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when connection fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Connection failed');
      expect(result.lastChecked).toBeInstanceOf(Date);
    });
  });

  describe('rate limiting', () => {
    it('should enforce request rate limits', async () => {
      const simpleRequest: LLMRequest = {
        providerId: 'test-provider',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Create provider with very low rate limit
      const rateLimitedConfig = { ...config, rateLimitRpm: 1 };
      const rateLimitedProvider = new APIProvider('test', 'Test', rateLimitedConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
          usage: { total_tokens: 10 }
        })
      });

      // First request should succeed
      await rateLimitedProvider.sendRequest(simpleRequest);

      // Second request should be rate limited
      await expect(rateLimitedProvider.sendRequest(simpleRequest))
        .rejects.toThrow(RateLimitError);
    });
  });
});