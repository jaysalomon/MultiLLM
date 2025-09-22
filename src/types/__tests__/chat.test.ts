import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ChatMessage,
  ConversationState,
  ModelParticipant,
  LLMResponse,
  MessageThread,
} from '../chat';
import type { LLMProvider } from '../providers';
import type { SharedMemoryContext } from '../memory';

describe('Chat Types', () => {
  let mockProvider: LLMProvider;
  let mockSharedMemory: SharedMemoryContext;

  beforeEach(() => {
    mockProvider = {
      id: 'provider-1',
      name: 'Test Provider',
      type: 'api',
      config: {
        displayName: 'Test API Provider',
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        modelName: 'test-model',
      },
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    mockSharedMemory = {
      conversationId: 'conv-1',
      facts: [],
      summaries: [],
      relationships: [],
      lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      version: 1,
    };
  });

  describe('ChatMessage', () => {
    it('should create a valid user message', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        content: 'Hello, world!',
        sender: 'user',
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(message.id).toBe('msg-1');
      expect(message.content).toBe('Hello, world!');
      expect(message.sender).toBe('user');
      expect(message.timestamp).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(message.replyTo).toBeUndefined();
      expect(message.metadata).toBeUndefined();
    });

    it('should create a valid LLM message with metadata', () => {
      const message: ChatMessage = {
        id: 'msg-2',
        content: 'Hello! How can I help you?',
        sender: 'gpt-4',
        timestamp: new Date('2024-01-01T00:01:00.000Z'),
        metadata: {
          model: 'gpt-4',
          provider: 'openai',
          processingTime: 1500,
          tokenCount: 25,
        },
      };

      expect(message.sender).toBe('gpt-4');
      expect(message.metadata?.model).toBe('gpt-4');
      expect(message.metadata?.provider).toBe('openai');
      expect(message.metadata?.processingTime).toBe(1500);
      expect(message.metadata?.tokenCount).toBe(25);
    });

    it('should create a reply message with replyTo field', () => {
      const message: ChatMessage = {
        id: 'msg-3',
        content: 'This is a reply to the previous message',
        sender: 'claude-3',
        timestamp: new Date('2024-01-01T00:02:00.000Z'),
        replyTo: 'msg-2',
        metadata: {
          model: 'claude-3-sonnet',
          provider: 'anthropic',
        },
      };

      expect(message.replyTo).toBe('msg-2');
      expect(message.sender).toBe('claude-3');
    });
  });

  describe('ModelParticipant', () => {
    it('should create a valid model participant', () => {
      const participant: ModelParticipant = {
        id: 'participant-1',
        provider: mockProvider,
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#10B981',
        isActive: true,
        addedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(participant.id).toBe('participant-1');
      expect(participant.provider).toEqual(mockProvider);
      expect(participant.modelName).toBe('gpt-4');
      expect(participant.displayName).toBe('GPT-4');
      expect(participant.color).toBe('#10B981');
      expect(participant.isActive).toBe(true);
      expect(participant.addedAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    it('should create a participant with optional avatar', () => {
      const participant: ModelParticipant = {
        id: 'participant-2',
        provider: mockProvider,
        modelName: 'claude-3',
        displayName: 'Claude 3',
        color: '#8B5CF6',
        avatar: 'https://example.com/avatar.png',
        isActive: false,
        addedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(participant.avatar).toBe('https://example.com/avatar.png');
      expect(participant.isActive).toBe(false);
    });
  });

  describe('LLMResponse', () => {
    it('should create a valid LLM response', () => {
      const response: LLMResponse = {
        modelId: 'gpt-4',
        content: 'This is a response from GPT-4',
        metadata: {
          processingTime: 2000,
          tokenCount: 15,
          finishReason: 'stop',
        },
      };

      expect(response.modelId).toBe('gpt-4');
      expect(response.content).toBe('This is a response from GPT-4');
      expect(response.metadata.processingTime).toBe(2000);
      expect(response.metadata.tokenCount).toBe(15);
      expect(response.metadata.finishReason).toBe('stop');
    });

    it('should create a response with error metadata', () => {
      const response: LLMResponse = {
        modelId: 'claude-3',
        content: '',
        metadata: {
          processingTime: 500,
          error: 'Rate limit exceeded',
        },
      };

      expect(response.content).toBe('');
      expect(response.metadata.error).toBe('Rate limit exceeded');
      expect(response.metadata.tokenCount).toBeUndefined();
    });
  });

  describe('ConversationState', () => {
    it('should create a valid conversation state', () => {
      const participant: ModelParticipant = {
        id: 'participant-1',
        provider: mockProvider,
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#10B981',
        isActive: true,
        addedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      const message: ChatMessage = {
        id: 'msg-1',
        content: 'Hello!',
        sender: 'user',
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
      };

      const conversation: ConversationState = {
        id: 'conv-1',
        participants: [participant],
        messages: [message],
        sharedMemory: mockSharedMemory,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:01:00.000Z'),
      };

      expect(conversation.id).toBe('conv-1');
      expect(conversation.participants).toHaveLength(1);
      expect(conversation.messages).toHaveLength(1);
      expect(conversation.sharedMemory).toEqual(mockSharedMemory);
      expect(conversation.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(conversation.updatedAt).toEqual(new Date('2024-01-01T00:01:00.000Z'));
    });
  });

  describe('MessageThread', () => {
    it('should create a valid message thread', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          content: 'Initial message',
          sender: 'gpt-4',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          id: 'msg-2',
          content: 'Reply to GPT-4',
          sender: 'claude-3',
          timestamp: new Date('2024-01-01T00:01:00.000Z'),
          replyTo: 'msg-1',
        },
      ];

      const thread: MessageThread = {
        id: 'thread-1',
        parentMessageId: 'msg-0',
        participants: ['gpt-4', 'claude-3'],
        messages,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      expect(thread.id).toBe('thread-1');
      expect(thread.parentMessageId).toBe('msg-0');
      expect(thread.participants).toEqual(['gpt-4', 'claude-3']);
      expect(thread.messages).toHaveLength(2);
      expect(thread.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });
  });
});