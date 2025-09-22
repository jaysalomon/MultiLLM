/**
 * Integration tests for Ollama provider with mock responses
 * Requirements: 4.2, 4.4, 2.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaProvider } from '../OllamaProvider';
import type { OllamaProviderConfig, LLMRequest } from '../../../types';
import {
  ProviderError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError,
  InvalidRequestError
} from '../../errors';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let config: OllamaProviderConfig;

  beforeEach(() => {
    config = {
      displayName: 'Test Ollama',
      host: 'http://localhost:11434',
      modelName: 'llama2',
      keepAlive: '5m',
      numCtx: 4096,
      numGpu: 1,
      temperature: 0.7,
      timeout: 30000
    };

    provider = new OllamaProvider('test-ollama', 'Test Ollama', config);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider.id).toBe('test-ollama');
      expect(provider.name).toBe('Test Ollama');
      expect(provider.type).toBe('ollama');
      expect(provider.config).toBe(config);
    });

    it('should handle host URL with trailing slash', () => {
      const configWithSlash = { ...config, host: 'http://localhost:11434/' };
      const providerWithSlash = new OllamaProvider('test', 'Test', configWithSlash);
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
      const invalidProvider = new OllamaProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Ollama host URL is required');
    });

    it('should detect invalid host URL', async () => {
      const invalidConfig = { ...config, host: 'not-a-url' };
      const invalidProvider = new OllamaProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid Ollama host URL format');
    });

    it('should detect missing model name', async () => {
      const invalidConfig = { ...config, modelName: '' };
      const invalidProvider = new OllamaProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Model name is required');
    });

    it('should detect invalid context window size', async () => {
      const invalidConfig = { ...config, numCtx: 0 };
      const invalidProvider = new OllamaProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Context window size must be greater than 0');
    });

    it('should detect negative GPU layers', async () => {
      const invalidConfig = { ...config, numGpu: -1 };
      const invalidProvider = new OllamaProvider('test', 'Test', invalidConfig);
      
      const result = await invalidProvider.validateConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Number of GPU layers cannot be negative');
    });

    it('should warn about invalid keep_alive format', async () => {
      const warningConfig = { ...config, keepAlive: 'invalid' };
      const warningProvider = new OllamaProvider('test', 'Test', warningConfig);
      
      const result = await warningProvider.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Invalid keep_alive format. Use formats like "5m", "1h", or "-1" for indefinite');
    });
  });

  describe('testConnection', () => {
    it('should successfully test connection with available model', async () => {
      const mockResponse = {
        models: [
          { name: 'llama2', modified_at: '2024-01-01T00:00:00Z', size: 1000000, digest: 'abc123' },
          { name: 'codellama', modified_at: '2024-01-01T00:00:00Z', size: 2000000, digest: 'def456' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.availableModels).toEqual(['llama2', 'codellama']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should fail when configured model is not available', async () => {
      const mockResponse = {
        models: [
          { name: 'codellama', modified_at: '2024-01-01T00:00:00Z', size: 2000000, digest: 'def456' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await provider.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Model 'llama2' not found");
      expect(result.availableModels).toEqual(['codellama']);
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
        models: [
          { name: 'llama2', modified_at: '2024-01-01T00:00:00Z', size: 1000000, digest: 'abc123' },
          { name: 'codellama', modified_at: '2024-01-01T00:00:00Z', size: 2000000, digest: 'def456' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const models = await provider.getAvailableModels();
      
      expect(models).toEqual(['llama2', 'codellama']);
    });

    it('should handle API errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      await expect(provider.getAvailableModels()).rejects.toThrow(ProviderError);
    });
  });

  describe('sendRequest', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test-ollama',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      temperature: 0.8,
      maxTokens: 1000
    };

    it('should send successful request', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2024-01-01T00:00:00Z',
        response: 'Hello! I am doing well, thank you for asking.',
        done: true,
        eval_count: 15,
        total_duration: 1500000000
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await provider.sendRequest(mockRequest);
      
      expect(response.modelId).toBe('test-ollama');
      expect(response.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(response.metadata.tokenCount).toBe(15);
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(response.metadata.finishReason).toBe('stop');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: expect.stringContaining('"model":"llama2"')
        })
      );
    });

    it('should handle multi-agent conversation context', async () => {
      const multiAgentRequest: LLMRequest = {
        ...mockRequest,
        messages: [
          { role: 'system', content: 'You are in a multi-agent conversation.' },
          { role: 'user', content: 'What do you think about AI?' },
          { role: 'assistant', content: 'AI is fascinating!', name: 'gpt-4' }
        ]
      };

      const mockResponse = {
        model: 'llama2',
        created_at: '2024-01-01T00:00:00Z',
        response: 'I agree with GPT-4, AI is indeed fascinating.',
        done: true,
        eval_count: 20
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await provider.sendRequest(multiAgentRequest);
      
      expect(response.content).toBe('I agree with GPT-4, AI is indeed fascinating.');
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.system).toBe('You are in a multi-agent conversation.');
      expect(requestBody.prompt).toContain('Human: What do you think about AI?');
      expect(requestBody.prompt).toContain('gpt-4: AI is fascinating!');
    });

    it('should handle model not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('model not found')
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

    it('should handle network connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(provider.sendRequest(mockRequest)).rejects.toThrow(NetworkError);
    });
  });

  describe('sendStreamingRequest', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test-ollama',
      messages: [
        { role: 'user', content: 'Tell me a story' }
      ]
    };

    it('should handle streaming response', async () => {
      const mockChunks = [
        { model: 'llama2', created_at: '2024-01-01T00:00:00Z', response: 'Once', done: false },
        { model: 'llama2', created_at: '2024-01-01T00:00:00Z', response: ' upon', done: false },
        { model: 'llama2', created_at: '2024-01-01T00:00:00Z', response: ' a time', done: false },
        { model: 'llama2', created_at: '2024-01-01T00:00:00Z', response: '', done: true }
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          mockChunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
          });
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
      expect(finalResponse.modelId).toBe('test-ollama');
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
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('invalid json\n'));
          controller.enqueue(new TextEncoder().encode('{"model":"llama2","response":"test","done":true}\n'));
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
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse Ollama stream chunk:', 'invalid json');
      
      consoleSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when connection succeeds', async () => {
      const mockResponse = {
        models: [
          { name: 'llama2', modified_at: '2024-01-01T00:00:00Z', size: 1000000, digest: 'abc123' }
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
      expect(rateLimitConfig.requestsPerMinute).toBe(60);
      expect(rateLimitConfig.tokensPerMinute).toBe(10000);
    });
  });

  describe('prompt conversion', () => {
    it('should convert messages to Ollama prompt format', async () => {
      const mockRequest: LLMRequest = {
        providerId: 'test-ollama',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!', name: 'assistant-1' },
          { role: 'user', content: 'How are you?' }
        ]
      };

      const mockResponse = {
        model: 'llama2',
        created_at: '2024-01-01T00:00:00Z',
        response: 'I am doing well!',
        done: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await provider.sendRequest(mockRequest);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      
      expect(requestBody.system).toBe('You are a helpful assistant.');
      expect(requestBody.prompt).toContain('Human: Hello');
      expect(requestBody.prompt).toContain('assistant-1: Hi there!');
      expect(requestBody.prompt).toContain('Human: How are you?');
      expect(requestBody.prompt.endsWith('Assistant: ')).toBe(true);
    });
  });
});