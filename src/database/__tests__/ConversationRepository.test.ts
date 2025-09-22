import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../Database';
import { ConversationRepository } from '../ConversationRepository';
import type { ChatMessage, ModelParticipant } from '../../types/chat';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('ConversationRepository', () => {
  let database: Database;
  let repository: ConversationRepository;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.join(__dirname, 'conversation-test.db');
    database = new Database(testDbPath);
    await database.initialize();
    repository = new ConversationRepository(database);
  });

  afterEach(async () => {
    await database.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('conversation management', () => {
    it('should create a new conversation', async () => {
      const conversationId = await repository.createConversation('Test Conversation');
      
      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe('string');
    });

    it('should get conversation by ID', async () => {
      const conversationId = await repository.createConversation('Test Conversation');
      const conversation = await repository.getConversation(conversationId);
      
      expect(conversation).toBeDefined();
      expect(conversation!.id).toBe(conversationId);
      expect(conversation!.messages).toEqual([]);
      expect(conversation!.participants).toEqual([]);
    });

    it('should return null for non-existent conversation', async () => {
      const conversation = await repository.getConversation('non-existent-id');
      expect(conversation).toBeNull();
    });

    it('should get all conversations', async () => {
      const id1 = await repository.createConversation('Conversation 1');
      const id2 = await repository.createConversation('Conversation 2');
      
      const conversations = await repository.getAllConversations();
      
      expect(conversations).toHaveLength(2);
      expect(conversations.map(c => c.id)).toContain(id1);
      expect(conversations.map(c => c.id)).toContain(id2);
    });

    it('should update conversation metadata', async () => {
      const conversationId = await repository.createConversation('Original Title');
      
      await repository.updateConversation(conversationId, {
        title: 'Updated Title',
        metadata: { custom: 'data' }
      });
      
      const conversation = await repository.getConversation(conversationId);
      expect(conversation).toBeDefined();
      // Note: We'd need to modify the repository to return metadata for full verification
    });

    it('should delete conversation', async () => {
      const conversationId = await repository.createConversation('To Delete');
      
      await repository.deleteConversation(conversationId);
      
      const conversation = await repository.getConversation(conversationId);
      expect(conversation).toBeNull();
    });
  });

  describe('message management', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = await repository.createConversation('Test Conversation');
    });

    it('should add a message', async () => {
      const message: ChatMessage = {
        id: uuidv4(),
        content: 'Hello, world!',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };

      await repository.addMessage(message);
      
      const messages = await repository.getMessages(conversationId);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello, world!');
      expect(messages[0].sender).toBe('user');
    });

    it('should get messages with pagination', async () => {
      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        const message: ChatMessage = {
          id: uuidv4(),
          content: `Message ${i}`,
          sender: 'user',
          timestamp: new Date(Date.now() + i * 1000),
          metadata: { conversationId }
        };
        await repository.addMessage(message);
      }

      const messages = await repository.getMessages(conversationId, 3, 1);
      expect(messages).toHaveLength(3);
    });

    it('should update a message', async () => {
      const message: ChatMessage = {
        id: uuidv4(),
        content: 'Original content',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };

      await repository.addMessage(message);
      await repository.updateMessage(message.id, {
        content: 'Updated content',
        metadata: { updated: true }
      });

      const messages = await repository.getMessages(conversationId);
      expect(messages[0].content).toBe('Updated content');
    });

    it('should delete a message', async () => {
      const message: ChatMessage = {
        id: uuidv4(),
        content: 'To be deleted',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };

      await repository.addMessage(message);
      await repository.deleteMessage(message.id);

      const messages = await repository.getMessages(conversationId);
      expect(messages).toHaveLength(0);
    });

    it('should handle message threading', async () => {
      const parentMessage: ChatMessage = {
        id: uuidv4(),
        content: 'Parent message',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };

      const replyMessage: ChatMessage = {
        id: uuidv4(),
        content: 'Reply message',
        sender: 'model-1',
        timestamp: new Date(),
        replyTo: parentMessage.id,
        metadata: { conversationId }
      };

      await repository.addMessage(parentMessage);
      await repository.addMessage(replyMessage);

      const messages = await repository.getMessages(conversationId);
      expect(messages).toHaveLength(2);
      expect(messages[1].replyTo).toBe(parentMessage.id);
    });
  });

  describe('participant management', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = await repository.createConversation('Test Conversation');
    });

    it('should add a participant', async () => {
      const participant: ModelParticipant = {
        id: uuidv4(),
        provider: {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'api',
          config: { apiKey: 'test-key' },
          isActive: true
        },
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#FF0000',
        isActive: true,
        addedAt: new Date()
      };

      await repository.addParticipant(conversationId, participant);

      const participants = await repository.getParticipants(conversationId);
      expect(participants).toHaveLength(1);
      expect(participants[0].displayName).toBe('GPT-4');
      expect(participants[0].modelName).toBe('gpt-4');
    });

    it('should update a participant', async () => {
      const participant: ModelParticipant = {
        id: uuidv4(),
        provider: {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'api',
          config: { apiKey: 'test-key' },
          isActive: true
        },
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#FF0000',
        isActive: true,
        addedAt: new Date()
      };

      await repository.addParticipant(conversationId, participant);
      await repository.updateParticipant(participant.id, {
        displayName: 'Updated GPT-4',
        color: '#00FF00',
        isActive: false
      });

      const participants = await repository.getParticipants(conversationId);
      expect(participants[0].displayName).toBe('Updated GPT-4');
      expect(participants[0].color).toBe('#00FF00');
      expect(participants[0].isActive).toBe(false);
    });

    it('should remove a participant', async () => {
      const participant: ModelParticipant = {
        id: uuidv4(),
        provider: {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'api',
          config: { apiKey: 'test-key' },
          isActive: true
        },
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        color: '#FF0000',
        isActive: true,
        addedAt: new Date()
      };

      await repository.addParticipant(conversationId, participant);
      await repository.removeParticipant(participant.id);

      const participants = await repository.getParticipants(conversationId);
      expect(participants).toHaveLength(0);
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      // Create test conversations with messages
      const conv1 = await repository.createConversation('JavaScript Discussion');
      const conv2 = await repository.createConversation('Python Tutorial');

      const message1: ChatMessage = {
        id: uuidv4(),
        content: 'Let\'s talk about JavaScript frameworks',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId: conv1 }
      };

      const message2: ChatMessage = {
        id: uuidv4(),
        content: 'Python is great for data science',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId: conv2 }
      };

      await repository.addMessage(message1);
      await repository.addMessage(message2);
    });

    it('should search conversations by title', async () => {
      const results = await repository.searchConversations('JavaScript');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Discussion');
      expect(results[0].matchType).toBe('title');
    });

    it('should search conversations by message content', async () => {
      const results = await repository.searchConversations('data science');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Python Tutorial');
      expect(results[0].matchType).toBe('message');
    });

    it('should limit search results', async () => {
      const results = await repository.searchConversations('Discussion', 1);
      expect(results).toHaveLength(1);
    });
  });

  describe('statistics', () => {
    it('should get conversation statistics', async () => {
      const conversationId = await repository.createConversation('Stats Test');
      
      // Add some messages
      for (let i = 0; i < 3; i++) {
        const message: ChatMessage = {
          id: uuidv4(),
          content: `Message ${i}`,
          sender: 'user',
          timestamp: new Date(),
          metadata: { conversationId }
        };
        await repository.addMessage(message);
      }

      // Add a participant
      const participant: ModelParticipant = {
        id: uuidv4(),
        provider: {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'api',
          config: {},
          isActive: true
        },
        modelName: 'test-model',
        displayName: 'Test Model',
        color: '#FF0000',
        isActive: true,
        addedAt: new Date()
      };
      await repository.addParticipant(conversationId, participant);

      const stats = await repository.getConversationStats(conversationId);
      
      expect(stats.messageCount).toBe(3);
      expect(stats.participantCount).toBe(1);
      expect(stats.firstMessageAt).toBeDefined();
      expect(stats.lastMessageAt).toBeDefined();
    });
  });
});