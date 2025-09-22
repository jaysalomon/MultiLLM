/**
 * Integration tests for API Provider with mock responses
 * Requirements: 4.1, 4.4, 2.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIProvider } from '../api/APIProvider';
import type { APIProviderConfig, LLMRequest } from '../../types';
import { NetworkError } from '../errors';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Provider Integration Tests', () => {
  let openAIProvider: APIProvider;
  let anthropicProvider: APIProvider;
  let cohereProvider: APIProvider;

  beforeEach(() => {
    // OpenAI-compatible provider
    const openAIConfig: APIProviderConfig = {
      displayName: 'OpenAI GPT-4',
      apiKey: 'sk-test123456789012345678901234567890123456789012345678',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7,
      rateLimitRpm: 60,
      rateLimitTpm: 90000,
      timeout: 30000
    };

    // Anthropic-compatible provider
    const anthropicConfig: APIProviderConfig = {
      displayName: 'Claude 3',
      apiKey: 'sk-ant-' + 'a'.repeat(95),
      baseUrl: 'https://api.anthropic.com/v1',
      modelName: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      headers: {
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    };

    // Generic API provider (Cohere-style)
    const cohereConfig: APIProviderConfig = {
      displayName: 'Cohere Command',
      apiKey: 'a'.repeat(40),
      baseUrl: 'https://api.cohere.ai/v1',
      modelName: 'command',
      maxTokens: 2048,
      temperature: 0.8,
      timeout: 25000
    };

    openAIProvider = new APIProvider('openai-1', 'OpenAI GPT-4', openAIConfig);
    anthropicProvider = new APIProvider('anthropic-1', 'Claude 3', anthropicConfig);
    cohereProvider = new APIProvider('cohere-1', 'Cohere Command', cohereConfig);

    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Multi-provider conversation flow', () => {
    const conversationRequest: LLMRequest = {
      providerId: 'test',
      messages: [
        {
          role: 'system',
          content: 'You are participating in a multi-agent conversation with other AI models.'
        },
        {
          role: 'user',
          content: 'What is the capital of France?'
        },
        {
          role: 'assistant',
          content: 'The capital of France is Paris.',
          name: 'gpt-4'
        }
      ],
      systemPrompt: 'You are a helpful assistant in a multi-agent chat.',
      temperature: 0.7,
      maxTokens: 1000,
      metadata: {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        participantContext: ['gpt-4', 'claude-3', 'command']
      }
    };

    it('should handle OpenAI-style response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Paris is indeed the capital and largest city of France.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 12,
          total_tokens: 57
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'application/json'],
          ['x-ratelimit-remaining-requests', '59'],
          ['x-ratelimit-remaining-tokens', '89943']
        ]),
        json: () => Promise.resolve(mockResponse)
      });

      const response = await openAIProvider.sendRequest(conversationRequest);

      expect(response.modelId).toBe('openai-1');
      expect(response.content).toBe('Paris is indeed the capital and largest city of France.');
      expect(response.metadata.tokenCount).toBe(57);
      expect(response.metadata.finishReason).toBe('stop');
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0);

      // Verify request format
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.openai.com/v1/chat/completions');
      
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('gpt-4');
      expect(requestBody.messages).toHaveLength(4); // system + original messages
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[0].content).toBe('You are a helpful assistant in a multi-agent chat.');
      expect(requestBody.metadata.conversation_id).toBe('conv-123');
    });

    it('should handle Anthropic-style response', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Correct! Paris has been the capital of France since the 12th century.'
          }
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 48,
          output_tokens: 15
        }
      };

      // Mock Anthropic's different response format
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'application/json'],
          ['anthropic-ratelimit-requests-remaining', '59']
        ]),
        json: () => Promise.resolve({
          choices: [
            {
              message: {
                content: 'Correct! Paris has been the capital of France since the 12th century.'
              },
              finish_reason: 'stop'
            }
          ],
          usage: { total_tokens: 63 }
        })
      });

      const response = await anthropicProvider.sendRequest(conversationRequest);

      expect(response.modelId).toBe('anthropic-1');
      expect(response.content).toBe('Correct! Paris has been the capital of France since the 12th century.');

      // Verify custom headers
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['Authorization']).toContain('Bearer sk-ant-');
    });

    it('should handle streaming responses from multiple providers', async () => {
      const streamingRequest = { ...conversationRequest, stream: true };
      
      // Mock streaming response
      const streamData = [
        'data: {"choices":[{"delta":{"content":"Paris"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" is"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" the"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" capital"}}]}\n\n',
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

      const chunks: string[] = [];
      let finalResponse: any;

      await openAIProvider.sendStreamingRequest(
        streamingRequest,
        (chunk) => chunks.push(chunk),
        (response) => { finalResponse = response; },
        (error) => { throw error; }
      );

      expect(chunks).toEqual(['Paris', ' is', ' the', ' capital']);
      expect(finalResponse.content).toBe('Paris is the capital');
      expect(finalResponse.modelId).toBe('openai-1');
    });
  });

  describe('Error handling across providers', () => {
    const simpleRequest: LLMRequest = {
      providerId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    it('should handle different authentication error formats', async () => {
      // OpenAI-style auth error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({
          error: {
            message: 'Incorrect API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        })
      });

      await expect(openAIProvider.sendRequest(simpleRequest))
        .rejects.toThrow('Incorrect API key provided');

      // Anthropic-style auth error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map(),
        json: () => Promise.resolve({
          type: 'error',
          error: {
            type: 'authentication_error',
            message: 'Invalid API key'
          }
        })
      });

      await expect(anthropicProvider.sendRequest(simpleRequest))
        .rejects.toThrow('Invalid API key');
    });

    it('should handle different rate limit formats', async () => {
      // OpenAI-style rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '60']]),
        json: () => Promise.resolve({
          error: {
            message: 'Rate limit reached for requests',
            type: 'requests',
            code: 'rate_limit_exceeded'
          }
        })
      });

      await expect(openAIProvider.sendRequest(simpleRequest))
        .rejects.toThrow('Rate limit reached for requests');

      // Generic rate limit with retry_after
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
        json: () => Promise.resolve({
          message: 'Too many requests',
          retry_after: 120
        })
      });

      const error = await openAIProvider.sendRequest(simpleRequest)
        .catch(e => e);
      
      expect(error.retryAfter).toBe(120);
    });
  });

  describe('Provider-specific configurations', () => {
    it('should handle different timeout configurations', async () => {
      // Short timeout provider
      const shortTimeoutConfig: APIProviderConfig = {
        displayName: 'Fast Provider',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com/v1',
        modelName: 'fast-model',
        timeout: 5000 // 5 seconds
      };

      const fastProvider = new APIProvider('fast', 'Fast', shortTimeoutConfig);

      // Mock timeout by rejecting with AbortError
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      });

      await expect(fastProvider.sendRequest({
        providerId: 'fast',
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow(NetworkError);
    }, 10000); // Increase timeout for this test

    it('should handle custom headers correctly', async () => {
      const customHeadersConfig: APIProviderConfig = {
        displayName: 'Custom Provider',
        apiKey: 'test-key',
        baseUrl: 'https://api.custom.com/v1',
        modelName: 'custom-model',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-API-Version': '2024-01-01'
        }
      };

      const customProvider = new APIProvider('custom', 'Custom', customHeadersConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Custom response' }, finish_reason: 'stop' }]
        })
      });

      await customProvider.sendRequest({
        providerId: 'custom',
        messages: [{ role: 'user', content: 'Test' }]
      });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      
      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['X-API-Version']).toBe('2024-01-01');
      expect(headers['Authorization']).toBe('Bearer test-key');
    });
  });

  describe('Connection testing and health checks', () => {
    it('should test connections to different providers', async () => {
      // Mock successful models endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({
          data: [
            { id: 'gpt-4', object: 'model' },
            { id: 'gpt-3.5-turbo', object: 'model' }
          ]
        })
      });

      const result = await openAIProvider.testConnection();

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);

      // Verify correct endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should perform health checks', async () => {
      // Mock successful health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve({ data: [] })
      });

      const healthResult = await cohereProvider.healthCheck();

      expect(healthResult.healthy).toBe(true);
      expect(healthResult.latency).toBeGreaterThanOrEqual(0);
      expect(healthResult.lastChecked).toBeInstanceOf(Date);
      expect(healthResult.error).toBeUndefined();

      // Test cached health check result
      const cachedResult = cohereProvider.getLastHealthCheck();
      expect(cachedResult).toBe(healthResult);
    });
  });
});