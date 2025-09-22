import { describe, it, expect, beforeEach } from 'vitest';
import type {
  LLMProvider,
  APIProviderConfig,
  OllamaProviderConfig,
  LMStudioProviderConfig,
  ProviderStatus,
  ProviderValidationResult,
  LLMRequest,
} from '../providers';

describe('Provider Types', () => {
  describe('LLMProvider', () => {
    it('should create a valid API provider', () => {
      const config: APIProviderConfig = {
        displayName: 'OpenAI GPT-4',
        apiKey: 'sk-test123',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4',
        maxTokens: 4096,
        temperature: 0.7,
        organization: 'org-test',
        rateLimitRpm: 60,
        rateLimitTpm: 90000,
      };

      const provider: LLMProvider = {
        id: 'openai-1',
        name: 'OpenAI GPT-4',
        type: 'api',
        config,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(provider.id).toBe('openai-1');
      expect(provider.name).toBe('OpenAI GPT-4');
      expect(provider.type).toBe('api');
      expect(provider.isActive).toBe(true);
      
      const apiConfig = provider.config as APIProviderConfig;
      expect(apiConfig.apiKey).toBe('sk-test123');
      expect(apiConfig.baseUrl).toBe('https://api.openai.com/v1');
      expect(apiConfig.modelName).toBe('gpt-4');
      expect(apiConfig.maxTokens).toBe(4096);
      expect(apiConfig.temperature).toBe(0.7);
      expect(apiConfig.organization).toBe('org-test');
      expect(apiConfig.rateLimitRpm).toBe(60);
      expect(apiConfig.rateLimitTpm).toBe(90000);
    });

    it('should create a valid Ollama provider', () => {
      const config: OllamaProviderConfig = {
        displayName: 'Local Llama 2',
        host: 'http://localhost:11434',
        modelName: 'llama2:7b',
        keepAlive: '5m',
        numCtx: 4096,
        numGpu: 1,
        temperature: 0.8,
      };

      const provider: LLMProvider = {
        id: 'ollama-1',
        name: 'Local Llama 2',
        type: 'ollama',
        config,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(provider.type).toBe('ollama');
      
      const ollamaConfig = provider.config as OllamaProviderConfig;
      expect(ollamaConfig.host).toBe('http://localhost:11434');
      expect(ollamaConfig.modelName).toBe('llama2:7b');
      expect(ollamaConfig.keepAlive).toBe('5m');
      expect(ollamaConfig.numCtx).toBe(4096);
      expect(ollamaConfig.numGpu).toBe(1);
    });

    it('should create a valid LM Studio provider', () => {
      const config: LMStudioProviderConfig = {
        displayName: 'LM Studio Model',
        host: 'http://localhost:1234',
        modelName: 'mistral-7b-instruct',
        apiKey: 'optional-key',
        maxTokens: 2048,
        timeout: 30000,
      };

      const provider: LLMProvider = {
        id: 'lmstudio-1',
        name: 'LM Studio Model',
        type: 'lmstudio',
        config,
        isActive: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(provider.type).toBe('lmstudio');
      expect(provider.isActive).toBe(false);
      
      const lmConfig = provider.config as LMStudioProviderConfig;
      expect(lmConfig.host).toBe('http://localhost:1234');
      expect(lmConfig.modelName).toBe('mistral-7b-instruct');
      expect(lmConfig.apiKey).toBe('optional-key');
      expect(lmConfig.maxTokens).toBe(2048);
      expect(lmConfig.timeout).toBe(30000);
    });
  });

  describe('ProviderStatus', () => {
    it('should create a valid connected status', () => {
      const status: ProviderStatus = {
        providerId: 'openai-1',
        isConnected: true,
        lastChecked: new Date('2024-01-01T00:00:00.000Z'),
        latency: 250,
        availableModels: ['gpt-4', 'gpt-3.5-turbo'],
      };

      expect(status.providerId).toBe('openai-1');
      expect(status.isConnected).toBe(true);
      expect(status.latency).toBe(250);
      expect(status.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(status.error).toBeUndefined();
    });

    it('should create a valid disconnected status with error', () => {
      const status: ProviderStatus = {
        providerId: 'ollama-1',
        isConnected: false,
        lastChecked: new Date('2024-01-01T00:00:00.000Z'),
        error: 'Connection refused: ECONNREFUSED',
      };

      expect(status.isConnected).toBe(false);
      expect(status.error).toBe('Connection refused: ECONNREFUSED');
      expect(status.latency).toBeUndefined();
      expect(status.availableModels).toBeUndefined();
    });
  });

  describe('ProviderValidationResult', () => {
    it('should create a valid validation result', () => {
      const result: ProviderValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Model may have limited context window'],
        availableModels: ['gpt-4', 'gpt-3.5-turbo'],
      };

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toBe('Model may have limited context window');
      expect(result.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('should create an invalid validation result with errors', () => {
      const result: ProviderValidationResult = {
        isValid: false,
        errors: [
          'Invalid API key format',
          'Base URL is not reachable',
        ],
        warnings: [],
      };

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Invalid API key format');
      expect(result.errors).toContain('Base URL is not reachable');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('LLMRequest', () => {
    it('should create a valid LLM request', () => {
      const request: LLMRequest = {
        providerId: 'openai-1',
        messages: [
          {
            role: 'system',
            content: 'You are participating in a multi-agent conversation.',
          },
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
          {
            role: 'assistant',
            content: 'I am doing well, thank you!',
            name: 'gpt-4',
          },
        ],
        systemPrompt: 'You are a helpful assistant in a multi-agent chat.',
        temperature: 0.7,
        maxTokens: 1000,
        stream: false,
        metadata: {
          conversationId: 'conv-1',
          messageId: 'msg-123',
          participantContext: ['gpt-4', 'claude-3', 'llama2'],
        },
      };

      expect(request.providerId).toBe('openai-1');
      expect(request.messages).toHaveLength(3);
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[1].role).toBe('user');
      expect(request.messages[2].role).toBe('assistant');
      expect(request.messages[2].name).toBe('gpt-4');
      expect(request.systemPrompt).toBe('You are a helpful assistant in a multi-agent chat.');
      expect(request.temperature).toBe(0.7);
      expect(request.maxTokens).toBe(1000);
      expect(request.stream).toBe(false);
      expect(request.metadata?.conversationId).toBe('conv-1');
      expect(request.metadata?.messageId).toBe('msg-123');
      expect(request.metadata?.participantContext).toEqual(['gpt-4', 'claude-3', 'llama2']);
    });

    it('should create a minimal LLM request', () => {
      const request: LLMRequest = {
        providerId: 'ollama-1',
        messages: [
          {
            role: 'user',
            content: 'What is the weather like?',
          },
        ],
      };

      expect(request.providerId).toBe('ollama-1');
      expect(request.messages).toHaveLength(1);
      expect(request.systemPrompt).toBeUndefined();
      expect(request.temperature).toBeUndefined();
      expect(request.maxTokens).toBeUndefined();
      expect(request.stream).toBeUndefined();
      expect(request.metadata).toBeUndefined();
    });
  });
});