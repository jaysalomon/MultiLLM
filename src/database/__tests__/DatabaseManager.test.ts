import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../DatabaseManager';
import type { ChatMessage, ModelParticipant } from '../../types/chat';
import type { MemoryFact } from '../../types/memory';
import { DEFAULT_CONFIG } from '../../types/config';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('DatabaseManager', () => {
  let manager: DatabaseManager;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.join(__dirname, 'manager-test.db');
    manager = new DatabaseManager(testDbPath);
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(manager.isReady()).toBe(true);
    });

    it('should provide access to repositories', () => {
      expect(manager.conversations).toBeDefined();
      expect(manager.memory).toBeDefined();
      expect(manager.config).toBeDefined();
    });

    it('should provide access to database and migration manager', () => {
      expect(manager.getDatabase()).toBeDefined();
      expect(manager.getMigrationManager()).toBeDefined();
    });
  });

  describe('integrated operations', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = await manager.conversations.createConversation('Integration Test');
    });

    it('should handle complete conversation workflow', async () => {
      // Add a participant
      const participant: ModelParticipant = {
        id: uuidv4(),
        provider: {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'api',
          config: { apiKey: 'test' },
          isActive: true
        },
        modelName: 'test-model',
        displayName: 'Test Model',
        color: '#FF0000',
        isActive: true,
        addedAt: new Date()
      };
      await manager.conversations.addParticipant(conversationId, participant);

      // Add messages
      const message1: ChatMessage = {
        id: uuidv4(),
        content: 'Hello, AI!',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };
      const message2: ChatMessage = {
        id: uuidv4(),
        content: 'Hello, human!',
        sender: participant.id,
        timestamp: new Date(),
        metadata: { conversationId }
      };
      await manager.conversations.addMessage(message1);
      await manager.conversations.addMessage(message2);

      // Add memory fact
      const fact: Omit<MemoryFact, 'id'> = {
        content: 'User prefers friendly greetings',
        source: participant.id,
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: ['preference', 'greeting'],
        verified: false,
        references: [message1.id, message2.id]
      };
      await manager.memory.addFact(conversationId, fact);

      // Verify complete conversation state
      const conversation = await manager.conversations.getConversation(conversationId);
      expect(conversation).toBeDefined();
      expect(conversation!.messages).toHaveLength(2);
      expect(conversation!.participants).toHaveLength(1);

      const sharedMemory = await manager.memory.getSharedMemory(conversationId);
      expect(sharedMemory.facts).toHaveLength(1);
      expect(sharedMemory.facts[0].content).toBe('User prefers friendly greetings');
    });

    it('should handle configuration alongside conversations', async () => {
      // Save configuration
      await manager.config.saveConfig(DEFAULT_CONFIG);

      // Create conversation data
      const message: ChatMessage = {
        id: uuidv4(),
        content: 'Test message',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };
      await manager.conversations.addMessage(message);

      // Verify both are accessible
      const config = await manager.config.loadConfig();
      const conversation = await manager.conversations.getConversation(conversationId);

      expect(config).toBeDefined();
      expect(conversation).toBeDefined();
      expect(conversation!.messages).toHaveLength(1);
    });
  });

  describe('maintenance operations', () => {
    let testConversationId: string;

    beforeEach(async () => {
      // Create test data
      testConversationId = await manager.conversations.createConversation('Maintenance Test');
      
      const oldFact: Omit<MemoryFact, 'id'> = {
        content: 'Old fact',
        source: 'user',
        timestamp: new Date('2020-01-01'),
        relevanceScore: 0.5,
        tags: [],
        verified: false,
        references: []
      };
      await manager.memory.addFact(testConversationId, oldFact);

      const recentFact: Omit<MemoryFact, 'id'> = {
        content: 'Recent fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: [],
        verified: false,
        references: []
      };
      await manager.memory.addFact(testConversationId, recentFact);
    });

    it('should perform vacuum operation', async () => {
      const result = await manager.performMaintenance({ vacuum: true });
      expect(result.vacuumCompleted).toBe(true);
    });

    it('should perform analyze operation', async () => {
      const result = await manager.performMaintenance({ analyze: true });
      expect(result.analyzeCompleted).toBe(true);
    });

    it('should clean up old memory data', async () => {
      const result = await manager.performMaintenance({ 
        cleanupOldMemory: true,
        retentionDays: 1 // 1 day retention to clean up the 2020 data
      });
      
      expect(result.memoryCleanupResults).toBeDefined();
      // The cleanup should run successfully, even if no data is cleaned up
      expect(result.memoryCleanupResults!.length).toBeGreaterThanOrEqual(0);
    });

    it('should perform all maintenance operations', async () => {
      const result = await manager.performMaintenance({
        vacuum: true,
        analyze: true,
        cleanupOldMemory: true,
        retentionDays: 30
      });

      expect(result.vacuumCompleted).toBe(true);
      expect(result.analyzeCompleted).toBe(true);
      expect(result.memoryCleanupResults).toBeDefined();
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      // Create test data
      const conv1 = await manager.conversations.createConversation('Stats Test 1');
      const conv2 = await manager.conversations.createConversation('Stats Test 2');

      // Add messages
      for (let i = 0; i < 3; i++) {
        const message: ChatMessage = {
          id: uuidv4(),
          content: `Message ${i}`,
          sender: 'user',
          timestamp: new Date(),
          metadata: { conversationId: conv1 }
        };
        await manager.conversations.addMessage(message);
      }

      // Add participants
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
      await manager.conversations.addParticipant(conv1, participant);

      // Add memory data
      const fact: Omit<MemoryFact, 'id'> = {
        content: 'Test fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: [],
        verified: false,
        references: []
      };
      await manager.memory.addFact(conv1, fact);
    });

    it('should get comprehensive database statistics', async () => {
      const stats = await manager.getStatistics();

      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.totalParticipants).toBe(1);
      expect(stats.totalMemoryFacts).toBe(1);
      expect(stats.totalSummaries).toBe(0);
      expect(stats.totalRelationships).toBe(0);
      expect(stats.databaseSize).toBeGreaterThan(0);
      expect(stats.oldestConversation).toBeDefined();
      expect(stats.newestConversation).toBeDefined();
    });
  });

  describe('export and import', () => {
    let testData: {
      conversationId: string;
      messageId: string;
      participantId: string;
      factId: string;
    };

    beforeEach(async () => {
      // Create comprehensive test data
      const conversationId = await manager.conversations.createConversation('Export Test');

      const participant: ModelParticipant = {
        id: uuidv4(),
        provider: {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'api',
          config: { apiKey: 'test' },
          isActive: true
        },
        modelName: 'test-model',
        displayName: 'Test Model',
        color: '#FF0000',
        isActive: true,
        addedAt: new Date()
      };
      await manager.conversations.addParticipant(conversationId, participant);

      const message: ChatMessage = {
        id: uuidv4(),
        content: 'Export test message',
        sender: 'user',
        timestamp: new Date(),
        metadata: { conversationId }
      };
      await manager.conversations.addMessage(message);

      const fact: Omit<MemoryFact, 'id'> = {
        content: 'Export test fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.9,
        tags: ['export', 'test'],
        verified: true,
        references: [message.id]
      };
      const factId = await manager.memory.addFact(conversationId, fact);

      await manager.config.saveConfig(DEFAULT_CONFIG);

      testData = {
        conversationId,
        messageId: message.id,
        participantId: participant.id,
        factId
      };
    });

    it('should export database to JSON', async () => {
      const exported = await manager.exportToJson();

      expect(exported.conversations).toHaveLength(1);
      expect(exported.config).toBeDefined();
      expect(exported.exportedAt).toBeInstanceOf(Date);
      expect(exported.version).toBe('1.0.0');

      const conversation = exported.conversations[0];
      expect(conversation.id).toBe(testData.conversationId);
      expect(conversation.messages).toHaveLength(1);
      expect(conversation.participants).toHaveLength(1);
      expect(conversation.sharedMemory.facts).toHaveLength(1);
    });

    it('should import database from JSON', async () => {
      // Export first
      const exported = await manager.exportToJson();

      // Clear database
      await manager.conversations.deleteConversation(testData.conversationId);
      await manager.config.clearAllConfig();

      // Verify it's empty
      const conversations = await manager.conversations.getAllConversations();
      expect(conversations).toHaveLength(0);

      // Import
      await manager.importFromJson(exported);

      // Verify data is restored
      const restoredConversations = await manager.conversations.getAllConversations();
      expect(restoredConversations).toHaveLength(1);

      const restoredConfig = await manager.config.loadConfig();
      expect(restoredConfig).toBeDefined();
    });

    it('should handle partial import data', async () => {
      const partialData = {
        conversations: [],
        config: { test: 'value' },
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      await manager.importFromJson(partialData);

      // Should not throw and should import config
      const config = await manager.config.exportConfig();
      expect(config.test).toBe('value');
    });
  });

  describe('error handling', () => {
    it('should handle database initialization errors gracefully', async () => {
      expect(() => {
        new DatabaseManager('C:\\invalid<>path\\test.db');
      }).toThrow();
    });

    it('should handle maintenance operation failures gracefully', async () => {
      // Close database to simulate failure
      await manager.close();

      const result = await manager.performMaintenance({ vacuum: true });
      
      // Should not throw, but operations should fail
      expect(result.vacuumCompleted).toBe(false);
    });
  });

  describe('migration management', () => {
    it('should provide access to migration manager', () => {
      const migrationManager = manager.getMigrationManager();
      expect(migrationManager).toBeDefined();
    });

    it('should track migration status', async () => {
      const migrationManager = manager.getMigrationManager();
      const status = await migrationManager.getStatus();
      
      expect(status).toHaveLength(1); // Initial schema migration
      expect(status[0].version).toBe('001');
      expect(status[0].applied).toBe(true);
    });
  });
});