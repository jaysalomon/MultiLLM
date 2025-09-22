/**
 * Comprehensive test to verify all provider implementations are complete
 * Requirements: 4.1, 4.2, 4.3, 4.5, 2.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIProvider } from '../api/APIProvider';
import { OllamaProvider } from '../ollama/OllamaProvider';
import { LMStudioProvider } from '../lmstudio/LMStudioProvider';
import type { 
  APIProviderConfig, 
  OllamaProviderConfig, 
  LMStudioProviderConfig,
  LLMRequest 
} from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Provider Implementation Completeness', () => {
  let apiProvider: APIProvider;
  let ollamaProvider: OllamaProvider;
  let lmStudioProvider: LMStudioProvider;

  beforeEach(() => {
    const apiConfig: APIProviderConfig = {
      displayName: 'Test API Provider',
      apiKey: 'sk-test123456789012345678901234567890123456789012345678',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000
    };

    const ollamaConfig: OllamaProviderConfig = {
      displayName: 'Test Ollama Provider',
      host: 'http://localhost:11434',
      modelName: 'llama2',
      keepAlive: '5m',
      numCtx: 4096,
      temperature: 0.7,
      timeout: 30000
    };

    const lmStudioConfig: LMStudioProviderConfig = {
      displayName: 'Test LM Studio Provider',
      host: 'http://localhost:1234',
      modelName: 'llama-2-7b-chat',
      apiKey: 'optional-key',
      temperature: 0.7,
      timeout: 30000
    };

    apiProvider = new APIProvider('api-test', 'API Test', apiConfig);
    ollamaProvider = new OllamaProvider('ollama-test', 'Ollama Test', ollamaConfig);
    lmStudioProvider = new LMStudioProvider('lmstudio-test', 'LM Studio Test', lmStudioConfig);

    mockFetch.mockClear();
  });

  describe('Interface Compliance', () => {
    const providers = [
      { name: 'APIProvider', provider: () => apiProvider },
      { name: 'OllamaProvider', provider: () => ollamaProvider },
      { name: 'LMStudioProvider', provider: () => lmStudioProvider }
    ];

    providers.forEach(({ name, provider }) => {
      describe(name, () => {
        it('should have all required properties', () => {
          const p = provider();
          expect(p.id).toBeDefined();
          expect(p.name).toBeDefined();
          expect(p.type).toBeDefined();
          expect(p.config).toBeDefined();
        });

        it('should have sendRequest method', () => {
          const p = provider();
          expect(typeof p.sendRequest).toBe('function');
        });

        it('should have sendStreamingRequest method', () => {
          const p = provider();
          expect(typeof p.sendStreamingRequest).toBe('function');
        });

        it('should have validateConfig method', () => {
          const p = provider();
          expect(typeof p.validateConfig).toBe('function');
        });

        it('should have testConnection method', () => {
          const p = provider();
          expect(typeof p.testConnection).toBe('function');
        });

        it('should have getAvailableModels method', () => {
          const p = provider();
          expect(typeof p.getAvailableModels).toBe('function');
        });

        it('should have healthCheck method', () => {
          const p = provider();
          expect(typeof p.healthCheck).toBe('function');
        });
      });
    });
  });

  describe('Method Return Types', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    it('APIProvider methods should return correct types', async () => {
      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
            usage: { total_tokens: 10 }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map(),
          json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] })
        });

      // Test sendRequest
      const response = await apiProvider.sendRequest(mockRequest);
      expect(response).toHaveProperty('modelId');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata).toHaveProperty('processingTime');

      // Test validateConfig
      const validation = await apiProvider.validateConfig();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);

      // Test testConnection
      const connection = await apiProvider.testConnection();
      expect(connection).toHaveProperty('success');
      expect(connection).toHaveProperty('latency');

      // Test getAvailableModels
      const models = await apiProvider.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);

      // Test healthCheck
      const health = await apiProvider.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('lastChecked');
      expect(health.lastChecked).toBeInstanceOf(Date);
    });

    it('OllamaProvider methods should return correct types', async () => {
      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            model: 'llama2',
            response: 'Hello!',
            done: true,
            eval_count: 10
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama2' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama2' }]
          })
        });

      // Test sendRequest
      const response = await ollamaProvider.sendRequest(mockRequest);
      expect(response).toHaveProperty('modelId');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');

      // Test validateConfig
      const validation = await ollamaProvider.validateConfig();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');

      // Test testConnection
      const connection = await ollamaProvider.testConnection();
      expect(connection).toHaveProperty('success');

      // Test getAvailableModels
      const models = await ollamaProvider.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);

      // Test healthCheck
      const health = await ollamaProvider.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('lastChecked');
    });

    it('LMStudioProvider methods should return correct types', async () => {
      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
            usage: { total_tokens: 10 }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 'llama-2-7b-chat' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 'llama-2-7b-chat' }]
          })
        });

      // Test sendRequest
      const response = await lmStudioProvider.sendRequest(mockRequest);
      expect(response).toHaveProperty('modelId');
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('metadata');

      // Test validateConfig
      const validation = await lmStudioProvider.validateConfig();
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');

      // Test testConnection
      const connection = await lmStudioProvider.testConnection();
      expect(connection).toHaveProperty('success');

      // Test getAvailableModels
      const models = await lmStudioProvider.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);

      // Test healthCheck
      const health = await lmStudioProvider.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('lastChecked');
    });
  });

  describe('Streaming Request Implementation', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test',
      messages: [{ role: 'user', content: 'Tell me a story' }]
    };

    it('should handle streaming for all providers', async () => {
      const providers = [
        { name: 'API', provider: apiProvider, streamData: 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n' },
        { name: 'Ollama', provider: ollamaProvider, streamData: '{"response":"Hello","done":false}\n{"response":"","done":true}\n' },
        { name: 'LMStudio', provider: lmStudioProvider, streamData: 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n' }
      ];

      for (const { name, provider, streamData } of providers) {
        const chunks: string[] = [];
        let finalResponse: any = null;
        let error: any = null;

        const mockStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(streamData));
            controller.close();
          }
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          body: mockStream
        });

        await provider.sendStreamingRequest(
          mockRequest,
          (chunk) => chunks.push(chunk),
          (response) => finalResponse = response,
          (err) => error = err
        );

        expect(error).toBeNull();
        expect(chunks.length).toBeGreaterThan(0);
        expect(finalResponse).toBeDefined();
        expect(finalResponse.modelId).toBeDefined();
        expect(finalResponse.content).toBeDefined();
        expect(finalResponse.metadata).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    const mockRequest: LLMRequest = {
      providerId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    it('should handle network errors consistently', async () => {
      const providers = [
        { name: 'API', provider: apiProvider },
        { name: 'Ollama', provider: ollamaProvider },
        { name: 'LMStudio', provider: lmStudioProvider }
      ];

      for (const { name, provider } of providers) {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(provider.sendRequest(mockRequest))
          .rejects.toThrow();
      }
    }, 15000); // Increase timeout

    it('should handle HTTP errors consistently', async () => {
      const providers = [
        { name: 'API', provider: apiProvider },
        { name: 'Ollama', provider: ollamaProvider },
        { name: 'LMStudio', provider: lmStudioProvider }
      ];

      for (const { name, provider } of providers) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error'),
          json: () => Promise.resolve({ error: { message: 'Server error' } })
        });

        await expect(provider.sendRequest(mockRequest))
          .rejects.toThrow();
      }
    }, 15000); // Increase timeout
  });

  describe('Configuration Validation', () => {
    it('should validate all provider configurations', async () => {
      const providers = [apiProvider, ollamaProvider, lmStudioProvider];

      for (const provider of providers) {
        const result = await provider.validateConfig();
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('warnings');
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    });

    it('should detect invalid configurations', async () => {
      // Test with invalid configs
      const invalidApiConfig: APIProviderConfig = {
        displayName: '',
        apiKey: '',
        baseUrl: '',
        modelName: '',
        temperature: 5.0 // Invalid temperature
      };

      const invalidOllamaConfig: OllamaProviderConfig = {
        displayName: '',
        host: '',
        modelName: '',
        numCtx: -1 // Invalid context size
      };

      const invalidLMStudioConfig: LMStudioProviderConfig = {
        displayName: '',
        host: '',
        modelName: ''
      };

      const invalidApiProvider = new APIProvider('invalid-api', 'Invalid API', invalidApiConfig);
      const invalidOllamaProvider = new OllamaProvider('invalid-ollama', 'Invalid Ollama', invalidOllamaConfig);
      const invalidLMStudioProvider = new LMStudioProvider('invalid-lmstudio', 'Invalid LM Studio', invalidLMStudioConfig);

      const apiResult = await invalidApiProvider.validateConfig();
      const ollamaResult = await invalidOllamaProvider.validateConfig();
      const lmStudioResult = await invalidLMStudioProvider.validateConfig();

      expect(apiResult.isValid).toBe(false);
      expect(apiResult.errors.length).toBeGreaterThan(0);

      expect(ollamaResult.isValid).toBe(false);
      expect(ollamaResult.errors.length).toBeGreaterThan(0);

      expect(lmStudioResult.isValid).toBe(false);
      expect(lmStudioResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limiting configuration', () => {
      const providers = [apiProvider, ollamaProvider, lmStudioProvider];

      for (const provider of providers) {
        // Access protected method through type assertion
        const rateLimitConfig = (provider as any).getRateLimitConfig();
        
        // Rate limiting can be null (no limits) or have configuration
        if (rateLimitConfig) {
          expect(rateLimitConfig).toHaveProperty('requestsPerMinute');
          expect(rateLimitConfig).toHaveProperty('tokensPerMinute');
        }
      }
    });
  });
});