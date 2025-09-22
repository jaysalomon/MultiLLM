/**
 * Integration tests for LM Studio provider with mock responses
 * Requirements: 4.3, 4.4, 2.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LMStudioProvider } from '../LMStudioProvider';
import type { LMStudioProviderConfig, LLMRequest } from '../../../types';
import {
  ProviderError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError,
  InvalidRequestError,
  AuthenticationError
} from '../../errors';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LMStudioProvider', () => {
  let provider: LMStudioProvider;
  let config: LMStudioProviderConfig;

  beforeEach(() => {
    config = {
      displayName: 'Test LM Studio',
      host: 'http://localhost:1234',
      modelName: 'llama-2-7b-chat',
      apiKey: 'optional-api-key',
      temperature: 0.7,
      timeout: 30000
    };

    provider = new LMStudioProvider('test-lmstudio', 'Test LM Studio', config);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider.id).toBe('test-lmstudio');
      expect(provider.name).toBe('Test LM Studio');
      expect(provider.type).toBe('lmstudio');
      expect(provider.config).toBe(config);
    });

    it('should handle host URL with trailing slash', () => {
      const configWithSlash = { ...config, host: 'http://localhost:1234/' };
      const providerWithSlash = new LMStudioProvider('test', 'Test', configWithSlash);
      expect(providerWithSlash).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', async () => {
      const result = await provider.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing host', async () => {
      const invalidConfig = { ...config, host: '' };
      const invalidProvider = new LMStudioProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LM Studio host URL is required');
    });

    it('should detect invalid host URL', async () => {
      const invalidConfig = { ...config, host: 'not-a-url' };
      const invalidProvider = new LMStudioProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid LM Studio host URL format');
    });

    it('should detect missing model name', async () => {
      const invalidConfig = { ...config, modelName: '' };
      const invalidProvider = new LMStudioProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model name is required');
    });

    it('should warn about short API key', async () => {
      const warningConfig = { ...config, apiKey: 'short' };
      const warningProvider = new LMStudioProvider('test', 'Test', warningConfig);
      
      const result = await warningProvider.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('API key seems too short (LM Studio typically doesn\'t require API keys for local usage)');
    });

    it('should detect non-HTTP protocol', async () => {
      const invalidConfig = { ...config, host: 'ftp://localhost:1234' };
      const invalidProvider = new LMStudioProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('LM Studio host must use HTTP or HTTPS protocol');
    });
  });

  describe('testConnection', () => {
    it('should successfully test connection with available model', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'llama-2-7b-chat', object: 'model', created: 1234567890, owned_by: 'lmstudio' },
          { id: 'codellama-7b', object: 'model', created: 1234567890, owned_by: 'lmstudio' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.availableModels).toEqual(['llama-2-7b-chat', 'codellama-7b']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/v1/models',
        expect.objectContaining({ 
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer optional-api-key'
          })
        })
      );
    });

    it('should fail when configured model is not available', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'codellama-7b', object: 'model', created: 1234567890, owned_by: 'lmstudio' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Model 'llama-2-7b-chat' not found");
      expect(result.availableModels).toEqual(['codellama-7b']);
    });

    it('should handle connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await provider.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'llama-2-7b-chat', object: 'model', created: 1234567890, owned_by: 'lmstudio' },
          { id: 'codellama-7b', object: 'model', created: 1234567890, owned_by: 'lmstudio' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const models = await provider.getAvailableModels();
      
      expect(models).toEqual(['llama-2-7b-chat', 'codellama-7b']);
    });

    it('should handle API errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      await expect(provider.getAvailableModels()).rejects.toThrow(ProviderError);
    });
  });

  describe('sendRequest', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test-lmstudio',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      temperature: 0.8,
      maxTokens: 1000
    };

    it('should send successful request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama-2-7b-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am doing well, thank you for asking.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await provider.sendRequest(mockRequest);
      
      expect(response.modelId).toBe('test-lmstudio');
      expect(response.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(response.metadata.tokenCount).toBe(25);
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(response.metadata.finishReason).toBe('stop');
      expect(response.usage?.totalTokens).toBe(25);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer optional-api-key'
          }),
          body: expect.stringContaining('"model":"llama-2-7b-chat"')
        })
      );
    });

    it('should handle authentication error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(provider.sendRequest(mockRequest)).rejects.toThrow(AuthenticationError);
    });

    it('should handle model not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Model not found')
      });

      await expect(provider.sendRequest(mockRequest)).rejects.toThrow(ModelNotFoundError);
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error')
      });

      await expect(provider.sendRequest(mockRequest)).rejects.toThrow(NetworkError);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      await expect(provider.sendRequest(mockRequest)).rejects.toThrow(TimeoutError);
    });

    it('should handle no choices in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama-2-7b-chat',
        choices: [],
        usage: { total_tokens: 10 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(provider.sendRequest(mockRequest)).rejects.toThrow(ProviderError);
    });
  });

  describe('sendStreamingRequest', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test-lmstudio',
      messages: [
        { role: 'user', content: 'Tell me a story' }
      ]
    };

    it('should handle streaming response', async () => {
      const mockStreamData = [
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama-2-7b-chat","choices":[{"index":0,"delta":{"content":"Once"}}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama-2-7b-chat","choices":[{"index":0,"delta":{"content":" upon"}}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama-2-7b-chat","choices":[{"index":0,"delta":{"content":" a time"}}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama-2-7b-chat","choices":[{"index":0,"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n'
      ].join('');

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockStreamData));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const chunks: string[] = [];
      let finalResponse: any = null;
      let error: any = null;

      await provider.sendStreamingRequest(
        mockRequest,
        (chunk) => chunks.push(chunk),
        (response) => finalResponse = response,
        (err) => error = err
      );

      expect(error).toBeNull();
      expect(chunks).toEqual(['Once', ' upon', ' a time']);
      expect(finalResponse).toBeDefined();
      expect(finalResponse.content).toBe('Once upon a time');
      expect(finalResponse.modelId).toBe('test-lmstudio');
    });

    it('should handle streaming errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error')
      });

      let error: any = null;

      await provider.sendStreamingRequest(
        mockRequest,
        () => {},
        () => {},
        (err) => error = err
      );

      expect(error).toBeInstanceOf(ProviderError);
    });

    it('should handle malformed stream chunks', async () => {
      const mockStreamData = [
        'data: invalid json\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1234567890,"model":"llama-2-7b-chat","choices":[{"index":0,"delta":{"content":"test"}}]}\n\n',
        'data: [DONE]\n\n'
      ].join('');

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockStreamData));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      const chunks: string[] = [];
      let finalResponse: any = null;
      let error: any = null;

      // Mock console.warn to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await provider.sendStreamingRequest(
        mockRequest,
        (chunk) => chunks.push(chunk),
        (response) => finalResponse = response,
        (err) => error = err
      );

      expect(error).toBeNull();
      expect(chunks).toEqual(['test']);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse LM Studio stream chunk:', 'invalid json');
      
      consoleSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when connection succeeds', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          { id: 'llama-2-7b-chat', object: 'model', created: 1234567890, owned_by: 'lmstudio' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const health = await provider.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
      expect(health.lastChecked).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when connection fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const health = await provider.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Connection failed');
      expect(health.lastChecked).toBeInstanceOf(Date);
    });
  });

  describe('rate limiting', () => {
    it('should have default rate limits', async () => {
      // Access protected method through type assertion
      const rateLimitConfig = (provider as any).getRateLimitConfig();
      
      expect(rateLimitConfig).toBeDefined();
      expect(rateLimitConfig.requestsPerMinute).toBe(120);
      expect(rateLimitConfig.tokensPerMinute).toBe(20000);
    });
  });

  describe('provider without API key', () => {
    it('should work without API key', async () => {
      const configWithoutKey = { ...config };
      delete configWithoutKey.apiKey;
      
      const providerWithoutKey = new LMStudioProvider('test', 'Test', configWithoutKey);
      
      const mockResponse = {
        object: 'list',
        data: [{ id: 'test-model', object: 'model', created: 1234567890, owned_by: 'lmstudio' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const models = await providerWithoutKey.getAvailableModels();
      
      expect(models).toEqual(['test-model']);
      
      // Verify no Authorization header was sent
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });
  });
});