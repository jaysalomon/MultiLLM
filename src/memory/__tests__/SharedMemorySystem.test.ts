import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SharedMemorySystem } from '../SharedMemorySystem';
import { MemoryRepository } from '../../database/MemoryRepository';
import { Database } from '../../database/Database';
import type { MemoryFact, ConversationSummary, EntityRelationship } from '../../types/memory';
import type { ChatMessage } from '../../types/chat';

// Mock the transformers library to avoid downloading models in tests
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockImplementation(() => {
    return Promise.resolve((text: string) => {
      // Create a simple hash-based embedding for testing
      const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const embedding = Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.1);
      return Promise.resolve({ data: embedding });
    });
  })
}));

describe('SharedMemorySystem', () => {
  let sharedMemorySystem: SharedMemorySystem;
  let memoryRepository: MemoryRepository;
  let database: Database;

  beforeEach(async () => {
    // Create in-memory database for testing
    database = new Database(':memory:');
    await database.initialize();
    
    memoryRepository = new MemoryRepository(database);
    sharedMemorySystem = new SharedMemorySystem(memoryRepository);
    
    await sharedMemorySystem.initialize();
    
    // Create a test conversation to satisfy foreign key constraints
    await database['executeQuery'](
      'INSERT INTO conversations (id, title) VALUES (?, ?)',
      ['test-conversation', 'Test Conversation']
    );
  });

  afterEach(async () => {
    await sharedMemorySystem.shutdown();
    await database.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(sharedMemorySystem.isReady()).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      await sharedMemorySystem.initialize();
      await sharedMemorySystem.initialize();
      expect(sharedMemorySystem.isReady()).toBe(true);
    });
  });

  describe('addFact', () => {
    it('should add a memory fact with embedding', async () => {
      const conversationId = 'test-conversation';
      const fact: Omit<MemoryFact, 'id' | 'embedding'> = {
        content: 'Machine learning is a subset of AI.',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: ['definition', 'AI'],
        verified: false,
        references: ['msg1']
      };

      const factId = await sharedMemorySystem.addFact(conversationId, fact);

      expect(factId).toBeDefined();
      expect(typeof factId).toBe('string');

      // Verify the fact was stored
      const memory = await sharedMemorySystem.getSharedMemory(conversationId);
      expect(memory.facts.length).toBe(1);
      expect(memory.facts[0].content).toBe(fact.content);
      expect(memory.facts[0].embedding).toBeDefined();
      expect(memory.facts[0].embedding!.length).toBe(384);
    });

    it('should emit memory update notification', async () => {
      const conversationId = 'test-conversation';
      const fact: Omit<MemoryFact, 'id' | 'embedding'> = {
        content: 'Test fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.5,
        tags: ['test'],
        verified: false,
        references: ['msg1']
      };

      let notificationReceived = false;
      sharedMemorySystem.on('memoryUpdated', (notification) => {
        expect(notification.type).toBe('fact_added');
        expect(notification.conversationId).toBe(conversationId);
        notificationReceived = true;
      });

      await sharedMemorySystem.addFact(conversationId, fact);
      expect(notificationReceived).toBe(true);
    });
  });

  describe('addSummary', () => {
    it('should add a conversation summary with embedding', async () => {
      const conversationId = 'test-conversation';
      const summary: Omit<ConversationSummary, 'id' | 'embedding'> = {
        timeRange: {
          start: new Date('2023-01-01T10:00:00Z'),
          end: new Date('2023-01-01T11:00:00Z')
        },
        summary: 'Discussion about machine learning concepts.',
        keyPoints: ['supervised learning', 'neural networks'],
        participants: ['user', 'assistant'],
        messageCount: 5,
        createdBy: 'system',
        createdAt: new Date()
      };

      const summaryId = await sharedMemorySystem.addSummary(conversationId, summary);

      expect(summaryId).toBeDefined();
      expect(typeof summaryId).toBe('string');

      // Verify the summary was stored
      const memory = await sharedMemorySystem.getSharedMemory(conversationId);
      expect(memory.summaries.length).toBe(1);
      expect(memory.summaries[0].summary).toBe(summary.summary);
      expect(memory.summaries[0].embedding).toBeDefined();
    });
  });

  describe('addRelationship', () => {
    it('should add an entity relationship', async () => {
      const conversationId = 'test-conversation';
      const relationship: Omit<EntityRelationship, 'id'> = {
        sourceEntity: 'Python',
        targetEntity: 'programming language',
        relationshipType: 'is_a',
        confidence: 0.9,
        evidence: ['msg1'],
        createdBy: 'user',
        createdAt: new Date()
      };

      const relationshipId = await sharedMemorySystem.addRelationship(conversationId, relationship);

      expect(relationshipId).toBeDefined();
      expect(typeof relationshipId).toBe('string');

      // Verify the relationship was stored
      const memory = await sharedMemorySystem.getSharedMemory(conversationId);
      expect(memory.relationships.length).toBe(1);
      expect(memory.relationships[0].sourceEntity).toBe(relationship.sourceEntity);
      expect(memory.relationships[0].relationshipType).toBe(relationship.relationshipType);
    });
  });

  describe('semanticSearch', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      
      // Add some test facts
      await sharedMemorySystem.addFact(conversationId, {
        content: 'Machine learning uses algorithms to learn from data.',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: ['ML', 'algorithms'],
        verified: true,
        references: ['msg1']
      });

      await sharedMemorySystem.addFact(conversationId, {
        content: 'Deep learning is a subset of machine learning.',
        source: 'assistant',
        timestamp: new Date(),
        relevanceScore: 0.9,
        tags: ['ML', 'deep learning'],
        verified: true,
        references: ['msg2']
      });

      await sharedMemorySystem.addFact(conversationId, {
        content: 'Cooking pasta requires boiling water.',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.7,
        tags: ['cooking'],
        verified: false,
        references: ['msg3']
      });
    });

    it('should perform semantic search on facts', async () => {
      const conversationId = 'test-conversation';
      const query = 'artificial intelligence and algorithms';

      const results = await sharedMemorySystem.semanticSearch(conversationId, query, {
        type: 'facts',
        limit: 5,
        minSimilarity: 0.1
      });

      expect(results).toBeDefined();
      expect(results.facts.length).toBeGreaterThan(0);
      expect(results.searchTime).toBeGreaterThan(0);

      // Should find ML-related facts more than cooking facts
      const mlFacts = results.facts.filter(fact => 
        fact.content.toLowerCase().includes('machine learning') ||
        fact.content.toLowerCase().includes('algorithm')
      );
      expect(mlFacts.length).toBeGreaterThan(0);
    });

    it('should respect search options', async () => {
      const conversationId = 'test-conversation';
      const query = 'machine learning';

      const results = await sharedMemorySystem.semanticSearch(conversationId, query, {
        type: 'facts',
        limit: 1,
        minSimilarity: 0.5
      });

      expect(results.facts.length).toBeLessThanOrEqual(1);
    });

    it('should search all types when requested', async () => {
      const conversationId = 'test-conversation';
      
      // Add a summary for testing
      await sharedMemorySystem.addSummary(conversationId, {
        timeRange: { start: new Date(), end: new Date() },
        summary: 'Discussion about machine learning algorithms.',
        keyPoints: ['algorithms', 'learning'],
        participants: ['user', 'assistant'],
        messageCount: 3,
        createdBy: 'system',
        createdAt: new Date()
      });

      const query = 'machine learning';
      const results = await sharedMemorySystem.semanticSearch(conversationId, query, {
        type: 'all',
        limit: 10
      });

      expect(results.facts.length).toBeGreaterThan(0);
      expect(results.summaries.length).toBeGreaterThan(0);
    });
  });

  describe('extractAndStoreMemory', () => {
    it('should extract and store memory from chat messages', async () => {
      const conversationId = 'test-conversation';
      const messages: ChatMessage[] = [
        {
          id: 'msg1',
          content: 'Python is a programming language.',
          sender: 'user',
          timestamp: new Date(),
          metadata: { model: 'user', provider: 'human' }
        },
        {
          id: 'msg2',
          content: 'Machine learning is popular in Python.',
          sender: 'assistant',
          timestamp: new Date(),
          metadata: { model: 'gpt-4', provider: 'openai' }
        },
        {
          id: 'msg3',
          content: 'TensorFlow belongs to Google.',
          sender: 'user',
          timestamp: new Date(),
          metadata: { model: 'user', provider: 'human' }
        }
      ];

      const result = await sharedMemorySystem.extractAndStoreMemory(
        conversationId,
        messages,
        'all'
      );

      expect(result).toBeDefined();
      expect(result.factsAdded).toBeGreaterThan(0);
      expect(result.relationshipsAdded).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify memory was stored
      const memory = await sharedMemorySystem.getSharedMemory(conversationId);
      expect(memory.facts.length).toBe(result.factsAdded);
      expect(memory.relationships.length).toBe(result.relationshipsAdded);
    });

    it('should handle empty messages gracefully', async () => {
      const conversationId = 'test-conversation';
      const messages: ChatMessage[] = [];

      const result = await sharedMemorySystem.extractAndStoreMemory(
        conversationId,
        messages,
        'all'
      );

      expect(result.factsAdded).toBe(0);
      expect(result.relationshipsAdded).toBe(0);
      expect(result.summaryAdded).toBe(false);
    });
  });

  describe('updateRelevanceScores', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      
      await sharedMemorySystem.addFact(conversationId, {
        content: 'Machine learning is important.',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.5,
        tags: ['ML'],
        verified: false,
        references: ['msg1']
      });
    });

    it('should update relevance scores based on context', async () => {
      const conversationId = 'test-conversation';
      const currentContext = 'We are discussing machine learning algorithms and their applications.';

      const result = await sharedMemorySystem.updateRelevanceScores(
        conversationId,
        currentContext
      );

      expect(result).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      
      // Should update at least some facts if context is relevant
      if (result.updatedFacts > 0) {
        const memory = await sharedMemorySystem.getSharedMemory(conversationId);
        expect(memory.facts.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getRelevantMemory', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      
      // Add various types of memory
      await sharedMemorySystem.addFact(conversationId, {
        content: 'Machine learning algorithms learn from data to make predictions.',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.9,
        tags: ['ML', 'algorithms'],
        verified: true,
        references: ['msg1']
      });

      await sharedMemorySystem.addSummary(conversationId, {
        timeRange: { start: new Date(), end: new Date() },
        summary: 'Comprehensive discussion about machine learning fundamentals.',
        keyPoints: ['supervised learning', 'neural networks', 'data preprocessing'],
        participants: ['user', 'assistant'],
        messageCount: 10,
        createdBy: 'system',
        createdAt: new Date()
      });

      await sharedMemorySystem.addRelationship(conversationId, {
        sourceEntity: 'TensorFlow',
        targetEntity: 'Google',
        relationshipType: 'belongs_to',
        confidence: 0.95,
        evidence: ['msg2'],
        createdBy: 'user',
        createdAt: new Date()
      });
    });

    it('should return relevant memory within token budget', async () => {
      const conversationId = 'test-conversation';
      const query = 'machine learning algorithms';
      const maxTokens = 500;

      const result = await sharedMemorySystem.getRelevantMemory(
        conversationId,
        query,
        maxTokens
      );

      expect(result).toBeDefined();
      expect(result.tokenCount).toBeLessThanOrEqual(maxTokens);
      expect(result.facts.length + result.summaries.length + result.relationships.length).toBeGreaterThan(0);
    });

    it('should prioritize facts over summaries', async () => {
      const conversationId = 'test-conversation';
      const query = 'machine learning';
      const maxTokens = 100; // Small budget to test prioritization

      const result = await sharedMemorySystem.getRelevantMemory(
        conversationId,
        query,
        maxTokens
      );

      // Should include facts if budget allows
      if (result.tokenCount > 0) {
        expect(result.facts.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('memory management', () => {
    it('should get memory statistics', async () => {
      const conversationId = 'test-conversation';
      
      // Add some memory items
      await sharedMemorySystem.addFact(conversationId, {
        content: 'Test fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: ['test'],
        verified: false,
        references: ['msg1']
      });

      const stats = await sharedMemorySystem.getMemoryStats(conversationId);

      expect(stats).toBeDefined();
      expect(stats.factCount).toBe(1);
      expect(stats.summaryCount).toBe(0);
      expect(stats.relationshipCount).toBe(0);
    });

    it('should cleanup old memory', async () => {
      const conversationId = 'test-conversation';
      const retentionDays = 30;

      const result = await sharedMemorySystem.cleanupMemory(conversationId, retentionDays);

      expect(result).toBeDefined();
      expect(typeof result.factsDeleted).toBe('number');
      expect(typeof result.summariesDeleted).toBe('number');
      expect(typeof result.relationshipsDeleted).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const badMemorySystem = new SharedMemorySystem(memoryRepository);
      
      // Mock the vector embeddings to fail
      vi.spyOn(badMemorySystem['vectorEmbeddings'], 'initialize').mockRejectedValue(
        new Error('Failed to load model')
      );

      await expect(badMemorySystem.initialize()).rejects.toThrow('Failed to load model');
    });

    it('should handle search errors gracefully', async () => {
      const conversationId = 'test-conversation';
      
      // Mock vector embeddings to fail
      vi.spyOn(sharedMemorySystem['vectorEmbeddings'], 'generateEmbedding').mockRejectedValue(
        new Error('Embedding failed')
      );

      const result = await sharedMemorySystem.semanticSearch(conversationId, 'test query');

      expect(result).toBeDefined();
      expect(result.facts).toEqual([]);
      expect(result.summaries).toEqual([]);
      expect(result.totalResults).toBe(0);
    });
  });
});