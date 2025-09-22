/**
 * Integration tests for LLM-to-LLM communication system
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMCommunicationSystem } from '../LLMCommunicationSystem';
import type { ChatMessage, ModelParticipant, LLMResponse } from '../../types/chat';
import type { LLMRequest } from '../../types/providers';

describe('LLMCommunicationSystem', () => {
  let communicationSystem: LLMCommunicationSystem;
  let mockParticipants: ModelParticipant[];
  let mockSendRequest: vi.MockedFunction<(modelId: string, request: LLMRequest) => Promise<LLMResponse>>;

  beforeEach(() => {
    communicationSystem = new LLMCommunicationSystem();
    
    mockParticipants = [
      {
        id: 'gpt-4',
        provider: {
          id: 'gpt-4',
          name: 'GPT-4',
          type: 'api',
          config: { apiKey: 'test', baseUrl: 'test', modelName: 'gpt-4', displayName: 'GPT-4' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#10a37f',
        isActive: true,
        addedAt: new Date()
      },
      {
        id: 'claude',
        provider: {
          id: 'claude',
          name: 'Claude',
          type: 'api',
          config: { apiKey: 'test', baseUrl: 'test', modelName: 'claude-3', displayName: 'Claude' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        modelName: 'claude-3',
        displayName: 'Claude',
        color: '#ff6b35',
        isActive: true,
        addedAt: new Date()
      },
      {
        id: 'llama',
        provider: {
          id: 'llama',
          name: 'Llama',
          type: 'ollama',
          config: { host: 'localhost:11434', modelName: 'llama2', displayName: 'Llama' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        modelName: 'llama2',
        displayName: 'Llama',
        color: '#007acc',
        isActive: true,
        addedAt: new Date()
      }
    ];

    mockSendRequest = vi.fn();
    communicationSystem.updateParticipants(mockParticipants);
  });

  describe('Mention Parsing', () => {
    it('should parse single @mention correctly', () => {
      // Requirements: 7.2
      const content = 'Hey @GPT-4, what do you think about this?';
      const mentions = communicationSystem.parseMentions(content, mockParticipants);

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        modelId: 'gpt-4',
        displayName: 'GPT-4',
        startIndex: 4,
        endIndex: 10,
        fullMention: '@GPT-4'
      });
    });

    it('should parse multiple @mentions correctly', () => {
      // Requirements: 7.2
      const content = '@GPT-4 and @Claude, can you both help with this? Also @Llama should join.';
      const mentions = communicationSystem.parseMentions(content, mockParticipants);

      expect(mentions).toHaveLength(3);
      expect(mentions[0].modelId).toBe('gpt-4');
      expect(mentions[1].modelId).toBe('claude');
      expect(mentions[2].modelId).toBe('llama');
    });

    it('should handle case-insensitive mentions', () => {
      // Requirements: 7.2
      const content = 'Hey @gpt-4 and @CLAUDE, what about @llama?';
      const mentions = communicationSystem.parseMentions(content, mockParticipants);

      expect(mentions).toHaveLength(3);
      expect(mentions.map(m => m.modelId)).toEqual(['gpt-4', 'claude', 'llama']);
    });

    it('should ignore invalid mentions', () => {
      // Requirements: 7.2
      const content = '@NonExistentModel and @GPT-4 are here';
      const mentions = communicationSystem.parseMentions(content, mockParticipants);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].modelId).toBe('gpt-4');
    });
  });

  describe('Message Routing', () => {
    it('should create broadcast routing for messages without mentions', () => {
      // Requirements: 7.1
      const message: ChatMessage = {
        id: 'msg1',
        content: 'Hello everyone!',
        sender: 'user',
        timestamp: new Date()
      };

      const routing = communicationSystem.createMessageRouting(message, mockParticipants);

      expect(routing.routingType).toBe('broadcast');
      expect(routing.targetIds).toEqual(['gpt-4', 'claude', 'llama']);
      expect(routing.isDirectMessage).toBe(false);
      expect(routing.mentionedModels).toHaveLength(0);
    });

    it('should create targeted routing for messages with mentions', () => {
      // Requirements: 7.1, 7.2
      const message: ChatMessage = {
        id: 'msg1',
        content: 'Hey @GPT-4 and @Claude, what do you think?',
        sender: 'user',
        timestamp: new Date()
      };

      const routing = communicationSystem.createMessageRouting(message, mockParticipants);

      expect(routing.routingType).toBe('targeted');
      expect(routing.targetIds).toEqual(['gpt-4', 'claude']);
      expect(routing.isDirectMessage).toBe(true);
      expect(routing.mentionedModels).toHaveLength(2);
    });

    it('should create reply routing for LLM responses', () => {
      // Requirements: 7.1
      const originalMessage: ChatMessage = {
        id: 'msg1',
        content: 'What is AI?',
        sender: 'user',
        timestamp: new Date()
      };

      const replyMessage: ChatMessage = {
        id: 'msg2',
        content: 'AI stands for Artificial Intelligence...',
        sender: 'gpt-4',
        timestamp: new Date(),
        replyTo: 'msg1'
      };

      const routing = communicationSystem.createMessageRouting(
        replyMessage,
        mockParticipants,
        originalMessage
      );

      expect(routing.routingType).toBe('reply');
      expect(routing.senderId).toBe('gpt-4');
    });
  });

  describe('Conversation Threading', () => {
    it('should create new thread for new conversation', () => {
      // Requirements: 7.3
      const threadId = communicationSystem.createOrUpdateThread(
        'msg1',
        'user',
        ['gpt-4', 'claude']
      );

      expect(threadId).toBeDefined();
      expect(threadId).toMatch(/^thread_\d+_[a-z0-9]+$/);

      const thread = communicationSystem.getThread(threadId);
      expect(thread).toBeDefined();
      expect(thread!.participantIds).toEqual(['user', 'gpt-4', 'claude']);
      expect(thread!.threadType).toBe('user-initiated');
      expect(thread!.isActive).toBe(true);
    });

    it('should update existing thread when replying', () => {
      // Requirements: 7.3
      const threadId1 = communicationSystem.createOrUpdateThread(
        'msg1',
        'user',
        ['gpt-4']
      );

      const message1: ChatMessage = {
        id: 'msg1',
        content: 'Hello GPT-4',
        sender: 'user',
        timestamp: new Date()
      };

      communicationSystem.addMessageToThread(threadId1, message1);

      // Create reply in same thread
      const threadId2 = communicationSystem.createOrUpdateThread(
        'msg2',
        'gpt-4',
        ['user'],
        'msg1'
      );

      expect(threadId2).toBe(threadId1);

      const thread = communicationSystem.getThread(threadId1);
      expect(thread!.participantIds).toContain('gpt-4');
      expect(thread!.messages).toHaveLength(1);
    });

    it('should handle LLM-to-LLM thread creation', () => {
      // Requirements: 7.3
      const threadId = communicationSystem.createOrUpdateThread(
        'msg1',
        'gpt-4',
        ['claude', 'llama']
      );

      const thread = communicationSystem.getThread(threadId);
      expect(thread!.threadType).toBe('llm-to-llm');
      expect(thread!.participantIds).toEqual(['gpt-4', 'claude', 'llama']);
    });
  });

  describe('Discussion Context Management', () => {
    it('should create discussion context with proper summary', () => {
      // Requirements: 7.4
      const conversationHistory: ChatMessage[] = [
        {
          id: 'msg1',
          content: 'What is machine learning?',
          sender: 'user',
          timestamp: new Date()
        },
        {
          id: 'msg2',
          content: 'Machine learning is a subset of AI...',
          sender: 'gpt-4',
          timestamp: new Date()
        }
      ];

      const context = communicationSystem.createDiscussionContext(
        'thread1',
        conversationHistory,
        mockParticipants,
        'Machine Learning Discussion'
      );

      expect(context.threadId).toBe('thread1');
      expect(context.conversationHistory).toEqual(conversationHistory);
      expect(context.activeParticipants).toEqual(mockParticipants);
      expect(context.discussionTopic).toBe('Machine Learning Discussion');
      expect(context.turnCount).toBe(0);
      expect(context.contextSummary).toContain('Machine Learning Discussion');
    });

    it('should update discussion context with new messages', () => {
      // Requirements: 7.4
      const context = communicationSystem.createDiscussionContext(
        'thread1',
        [],
        mockParticipants
      );

      const newMessage: ChatMessage = {
        id: 'msg1',
        content: 'New message',
        sender: 'claude',
        timestamp: new Date()
      };

      communicationSystem.updateDiscussionContext('thread1', newMessage);

      const updatedContext = communicationSystem.getDiscussionContext('thread1');
      expect(updatedContext!.conversationHistory).toHaveLength(1);
      expect(updatedContext!.turnCount).toBe(1);
      expect(updatedContext!.lastActivity).toBeDefined();
    });
  });

  describe('Message Routing Integration', () => {
    beforeEach(() => {
      mockSendRequest.mockImplementation(async (modelId: string, request: LLMRequest) => ({
        modelId,
        content: `Response from ${modelId}`,
        metadata: {
          processingTime: 100,
          tokenCount: 50
        }
      }));
    });

    it('should route message to targeted models', async () => {
      // Requirements: 7.1, 7.2
      const message: ChatMessage = {
        id: 'msg1',
        content: '@GPT-4 what do you think about AI?',
        sender: 'user',
        timestamp: new Date()
      };

      const routing = communicationSystem.createMessageRouting(message, mockParticipants);
      const threadId = communicationSystem.createOrUpdateThread(
        message.id,
        message.sender,
        routing.targetIds
      );

      const discussionContext = communicationSystem.createDiscussionContext(
        threadId,
        [message],
        mockParticipants
      );

      const responses = await communicationSystem.routeMessage(
        routing,
        message,
        discussionContext,
        mockSendRequest
      );

      expect(responses.size).toBe(1);
      expect(responses.has('gpt-4')).toBe(true);
      expect(mockSendRequest).toHaveBeenCalledTimes(1);
      expect(mockSendRequest).toHaveBeenCalledWith('gpt-4', expect.any(Object));
    });

    it('should route message to all models for broadcast', async () => {
      // Requirements: 7.1
      const message: ChatMessage = {
        id: 'msg1',
        content: 'Hello everyone!',
        sender: 'user',
        timestamp: new Date()
      };

      const routing = communicationSystem.createMessageRouting(message, mockParticipants);
      const threadId = communicationSystem.createOrUpdateThread(
        message.id,
        message.sender,
        routing.targetIds
      );

      const discussionContext = communicationSystem.createDiscussionContext(
        threadId,
        [message],
        mockParticipants
      );

      const responses = await communicationSystem.routeMessage(
        routing,
        message,
        discussionContext,
        mockSendRequest
      );

      expect(responses.size).toBe(3);
      expect(responses.has('gpt-4')).toBe(true);
      expect(responses.has('claude')).toBe(true);
      expect(responses.has('llama')).toBe(true);
      expect(mockSendRequest).toHaveBeenCalledTimes(3);
    });

    it('should handle routing errors gracefully', async () => {
      // Requirements: 7.1
      mockSendRequest.mockImplementation(async (modelId: string) => {
        if (modelId === 'gpt-4') {
          throw new Error('Connection failed');
        }
        return {
          modelId,
          content: `Response from ${modelId}`,
          metadata: { processingTime: 100 }
        };
      });

      const message: ChatMessage = {
        id: 'msg1',
        content: 'Hello everyone!',
        sender: 'user',
        timestamp: new Date()
      };

      const routing = communicationSystem.createMessageRouting(message, mockParticipants);
      const threadId = communicationSystem.createOrUpdateThread(
        message.id,
        message.sender,
        routing.targetIds
      );

      const discussionContext = communicationSystem.createDiscussionContext(
        threadId,
        [message],
        mockParticipants
      );

      const responses = await communicationSystem.routeMessage(
        routing,
        message,
        discussionContext,
        mockSendRequest
      );

      expect(responses.size).toBe(3);
      expect(responses.get('gpt-4')?.metadata.error).toBe('Connection failed');
      expect(responses.get('claude')?.content).toBe('Response from claude');
      expect(responses.get('llama')?.content).toBe('Response from llama');
    });
  });

  describe('Thread Management', () => {
    it('should get active threads', () => {
      // Requirements: 7.3
      const threadId1 = communicationSystem.createOrUpdateThread('msg1', 'user', ['gpt-4']);
      const threadId2 = communicationSystem.createOrUpdateThread('msg2', 'user', ['claude']);
      
      communicationSystem.closeThread(threadId2);

      const activeThreads = communicationSystem.getActiveThreads();
      expect(activeThreads).toHaveLength(1);
      expect(activeThreads[0].id).toBe(threadId1);
    });

    it('should close threads properly', () => {
      // Requirements: 7.3
      const threadId = communicationSystem.createOrUpdateThread('msg1', 'user', ['gpt-4']);
      
      communicationSystem.createDiscussionContext(threadId, [], mockParticipants);
      
      communicationSystem.closeThread(threadId);

      const thread = communicationSystem.getThread(threadId);
      expect(thread!.isActive).toBe(false);
      
      const context = communicationSystem.getDiscussionContext(threadId);
      expect(context).toBeUndefined();
    });
  });

  describe('Multi-turn LLM Discussions', () => {
    it('should handle multi-turn LLM-to-LLM conversation', async () => {
      // Requirements: 7.3, 7.4
      mockSendRequest.mockImplementation(async (modelId: string, request: LLMRequest) => ({
        modelId,
        content: `${modelId} responds to the discussion`,
        metadata: { processingTime: 100 }
      }));

      // Initial user message
      const userMessage: ChatMessage = {
        id: 'msg1',
        content: 'What are the pros and cons of different AI approaches?',
        sender: 'user',
        timestamp: new Date()
      };

      // GPT-4 responds
      const gptMessage: ChatMessage = {
        id: 'msg2',
        content: '@Claude what do you think about symbolic AI vs neural networks?',
        sender: 'gpt-4',
        timestamp: new Date(),
        replyTo: 'msg1'
      };

      // Route GPT-4's message to Claude
      const routing = communicationSystem.createMessageRouting(gptMessage, mockParticipants);
      expect(routing.routingType).toBe('targeted');
      expect(routing.targetIds).toEqual(['claude']);

      const threadId = communicationSystem.createOrUpdateThread(
        gptMessage.id,
        gptMessage.sender,
        routing.targetIds,
        userMessage.id
      );

      const discussionContext = communicationSystem.createDiscussionContext(
        threadId,
        [userMessage, gptMessage],
        mockParticipants
      );

      const responses = await communicationSystem.routeMessage(
        routing,
        gptMessage,
        discussionContext,
        mockSendRequest
      );

      expect(responses.size).toBe(1);
      expect(responses.has('claude')).toBe(true);
      
      const thread = communicationSystem.getThread(threadId);
      expect(thread!.threadType).toBe('mixed'); // Started with user, now has LLM-to-LLM
      expect(thread!.participantIds).toContain('gpt-4');
      expect(thread!.participantIds).toContain('claude');
    });
  });
});