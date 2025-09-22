import { describe, it, expect } from 'vitest';
import {
  validateChatMessage,
  validateModelParticipant,
  validateProviderConfig,
  validateMemoryFact,
  validateSharedMemoryContext,
  validateApplicationConfig,
} from '../validation';
import type { ChatMessage, ModelParticipant } from '../../types/chat';
import type { LLMProvider, APIProviderConfig } from '../../types/providers';
import type { MemoryFact, SharedMemoryContext } from '../../types/memory';
import { DEFAULT_CONFIG } from '../../types/config';

describe('Validation Utils', () => {
  describe('validateChatMessage', () => {
    it('should validate a correct chat message', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        content: 'Hello world',
        sender: 'user',
        timestamp: new Date(),
      };

      const result = validateChatMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject message with missing id', () => {
      const message = {
        content: 'Hello world',
        sender: 'user',
        timestamp: new Date(),
      };

      const result = validateChatMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('id');
      expect(result.errors[0].code).toBe('INVALID_ID');
    });

    it('should reject message with invalid timestamp', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello world',
        sender: 'user',
        timestamp: 'invalid-date',
      };

      const result = validateChatMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'timestamp')).toBe(true);
    });

    it('should reject message with invalid replyTo type', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello world',
        sender: 'user',
        timestamp: new Date(),
        replyTo: 123, // should be string
      };

      const result = validateChatMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'replyTo')).toBe(true);
    });
  });

  describe('validateModelParticipant', () => {
    it('should validate a correct model participant', () => {
      const participant: ModelParticipant = {
        id: 'participant-1',
        provider: {} as any, // Mock provider
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#10B981',
        isActive: true,
        addedAt: new Date(),
      };

      const result = validateModelParticipant(participant);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject participant with missing required fields', () => {
      const participant = {
        provider: {} as any,
        isActive: true,
        addedAt: new Date(),
      };

      const result = validateModelParticipant(participant);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
      expect(result.errors.some(e => e.field === 'modelName')).toBe(true);
      expect(result.errors.some(e => e.field === 'displayName')).toBe(true);
      expect(result.errors.some(e => e.field === 'color')).toBe(true);
    });

    it('should reject participant with invalid isActive type', () => {
      const participant = {
        id: 'participant-1',
        provider: {} as any,
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#10B981',
        isActive: 'true', // should be boolean
        addedAt: new Date(),
      };

      const result = validateModelParticipant(participant);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'isActive')).toBe(true);
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate a correct API provider', () => {
      const provider: LLMProvider = {
        id: 'openai-1',
        name: 'OpenAI GPT-4',
        type: 'api',
        config: {
          displayName: 'OpenAI GPT-4',
          apiKey: 'sk-test123',
          baseUrl: 'https://api.openai.com/v1',
          modelName: 'gpt-4',
        } as APIProviderConfig,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = validateProviderConfig(provider);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject provider with invalid type', () => {
      const provider = {
        id: 'invalid-1',
        name: 'Invalid Provider',
        type: 'invalid-type',
        config: {},
        isActive: true,
      };

      const result = validateProviderConfig(provider);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Provider type must be one of'))).toBe(true);
    });

    it('should reject API provider with missing API key', () => {
      const provider = {
        id: 'openai-1',
        name: 'OpenAI GPT-4',
        type: 'api',
        config: {
          displayName: 'OpenAI GPT-4',
          baseUrl: 'https://api.openai.com/v1',
          modelName: 'gpt-4',
          // missing apiKey
        },
        isActive: true,
      };

      const result = validateProviderConfig(provider);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('API key is required'))).toBe(true);
    });

    it('should reject provider with invalid URL', () => {
      const provider = {
        id: 'openai-1',
        name: 'OpenAI GPT-4',
        type: 'api',
        config: {
          displayName: 'OpenAI GPT-4',
          apiKey: 'sk-test123',
          baseUrl: 'invalid-url',
          modelName: 'gpt-4',
        },
        isActive: true,
      };

      const result = validateProviderConfig(provider);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Base URL must be a valid URL'))).toBe(true);
    });

    it('should add warnings for invalid temperature', () => {
      const provider = {
        id: 'openai-1',
        name: 'OpenAI GPT-4',
        type: 'api',
        config: {
          displayName: 'OpenAI GPT-4',
          apiKey: 'sk-test123',
          baseUrl: 'https://api.openai.com/v1',
          modelName: 'gpt-4',
          temperature: 5, // invalid range
        },
        isActive: true,
      };

      const result = validateProviderConfig(provider);
      expect(result.warnings.some(w => w.includes('Temperature should be a number between 0 and 2'))).toBe(true);
    });
  });

  describe('validateMemoryFact', () => {
    it('should validate a correct memory fact', () => {
      const fact: MemoryFact = {
        id: 'fact-1',
        content: 'User prefers dark mode',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.9,
        tags: ['preference'],
        verified: true,
        references: ['msg-1'],
      };

      const result = validateMemoryFact(fact);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject fact with invalid relevance score', () => {
      const fact = {
        id: 'fact-1',
        content: 'User prefers dark mode',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 1.5, // invalid range
        tags: ['preference'],
        verified: true,
        references: ['msg-1'],
      };

      const result = validateMemoryFact(fact);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'relevanceScore')).toBe(true);
    });

    it('should reject fact with non-array tags', () => {
      const fact = {
        id: 'fact-1',
        content: 'User prefers dark mode',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.9,
        tags: 'preference', // should be array
        verified: true,
        references: ['msg-1'],
      };

      const result = validateMemoryFact(fact);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'tags')).toBe(true);
    });
  });

  describe('validateSharedMemoryContext', () => {
    it('should validate a correct shared memory context', () => {
      const context: SharedMemoryContext = {
        conversationId: 'conv-1',
        facts: [],
        summaries: [],
        relationships: [],
        lastUpdated: new Date(),
        version: 1,
      };

      const result = validateSharedMemoryContext(context);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject context with missing conversation ID', () => {
      const context = {
        facts: [],
        summaries: [],
        relationships: [],
        lastUpdated: new Date(),
        version: 1,
      };

      const result = validateSharedMemoryContext(context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'conversationId')).toBe(true);
    });

    it('should reject context with invalid version', () => {
      const context = {
        conversationId: 'conv-1',
        facts: [],
        summaries: [],
        relationships: [],
        lastUpdated: new Date(),
        version: -1, // invalid negative version
      };

      const result = validateSharedMemoryContext(context);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'version')).toBe(true);
    });
  });

  describe('validateApplicationConfig', () => {
    it('should validate the default configuration', () => {
      const result = validateApplicationConfig(DEFAULT_CONFIG);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with missing sections', () => {
      const config = {
        app: DEFAULT_CONFIG.app,
        // missing other sections
      };

      const result = validateApplicationConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'providers')).toBe(true);
      expect(result.errors.some(e => e.field === 'memory')).toBe(true);
      expect(result.errors.some(e => e.field === 'ui')).toBe(true);
      expect(result.errors.some(e => e.field === 'export')).toBe(true);
      expect(result.errors.some(e => e.field === 'security')).toBe(true);
    });

    it('should reject config with invalid config version', () => {
      const config = {
        ...DEFAULT_CONFIG,
        configVersion: 123, // should be string
      };

      const result = validateApplicationConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'configVersion')).toBe(true);
    });
  });
});