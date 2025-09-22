import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryExtractor } from '../MemoryExtractor';
import { MemoryRepository } from '../../database/MemoryRepository';
import { Database } from '../../database/Database';
import type { MemoryExtractionRequest } from '../../types/memory';

describe('Memory System Integration', () => {
  let memoryExtractor: MemoryExtractor;
  let memoryRepository: MemoryRepository;
  let database: Database;

  beforeEach(async () => {
    database = new Database(':memory:');
    await database.initialize();
    memoryRepository = new MemoryRepository(database);
    memoryExtractor = new MemoryExtractor();

    // Create test conversation
    await database['executeQuery'](
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ['test-conversation', 'Test Conversation', new Date().toISOString(), new Date().toISOString()]
    );
  });

  afterEach(async () => {
    await database.close();
  });

  describe('Memory extraction and storage', () => {
    it('should extract facts and store them in database', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Python is a programming language.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'Machine learning is popular in Python.',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'facts'
      };

      // Extract memory
      const extractionResult = await memoryExtractor.extractMemory(request);
      expect(extractionResult.facts.length).toBeGreaterThan(0);

      // Store facts in database
      for (const fact of extractionResult.facts) {
        const factId = await memoryRepository.addFact('test-conversation', fact);
        expect(factId).toBeDefined();
      }

      // Verify facts were stored
      const storedFacts = await memoryRepository.getFacts('test-conversation');
      expect(storedFacts.length).toBe(extractionResult.facts.length);
    });

    it('should extract relationships and store them in database', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Python is a language.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'TensorFlow belongs to Google.',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'relationships'
      };

      // Extract memory
      const extractionResult = await memoryExtractor.extractMemory(request);
      expect(extractionResult.relationships.length).toBeGreaterThan(0);

      // Store relationships in database
      for (const relationship of extractionResult.relationships) {
        const relationshipId = await memoryRepository.addRelationship('test-conversation', relationship);
        expect(relationshipId).toBeDefined();
      }

      // Verify relationships were stored
      const storedRelationships = await memoryRepository.getRelationships('test-conversation');
      expect(storedRelationships.length).toBe(extractionResult.relationships.length);
    });

    it('should generate and store conversation summaries', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Let\'s discuss machine learning.',
            sender: 'user',
            timestamp: new Date('2023-01-01T10:00:00Z')
          },
          {
            id: 'msg2',
            content: 'Machine learning is a subset of AI.',
            sender: 'assistant',
            timestamp: new Date('2023-01-01T10:01:00Z')
          },
          {
            id: 'msg3',
            content: 'What about deep learning?',
            sender: 'user',
            timestamp: new Date('2023-01-01T10:02:00Z')
          }
        ],
        extractionType: 'summary'
      };

      // Extract memory
      const extractionResult = await memoryExtractor.extractMemory(request);
      expect(extractionResult.summary).toBeDefined();

      if (extractionResult.summary) {
        // Store summary in database
        const summaryId = await memoryRepository.addSummary('test-conversation', extractionResult.summary);
        expect(summaryId).toBeDefined();

        // Verify summary was stored
        const storedSummaries = await memoryRepository.getSummaries('test-conversation');
        expect(storedSummaries.length).toBe(1);
        expect(storedSummaries[0].messageCount).toBe(3);
      }
    });

    it('should perform text-based memory search', async () => {
      // Add some test facts
      await memoryRepository.addFact('test-conversation', {
        content: 'Machine learning uses algorithms to learn from data.',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: ['ML', 'algorithms'],
        verified: true,
        references: ['msg1']
      });

      await memoryRepository.addFact('test-conversation', {
        content: 'Python is great for data science.',
        source: 'assistant',
        timestamp: new Date(),
        relevanceScore: 0.7,
        tags: ['Python', 'data science'],
        verified: false,
        references: ['msg2']
      });

      // Search for machine learning related facts
      const searchResult = await memoryRepository.searchMemory('test-conversation', {
        query: 'machine learning',
        type: 'facts',
        limit: 10
      });

      expect(searchResult.facts.length).toBeGreaterThan(0);
      expect(searchResult.facts[0].content).toContain('Machine learning');
      expect(searchResult.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should get memory statistics', async () => {
      // Add test data
      await memoryRepository.addFact('test-conversation', {
        content: 'Test fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.5,
        tags: ['test'],
        verified: false,
        references: ['msg1']
      });

      await memoryRepository.addSummary('test-conversation', {
        timeRange: { start: new Date(), end: new Date() },
        summary: 'Test summary',
        keyPoints: ['test'],
        participants: ['user'],
        messageCount: 1,
        createdBy: 'system',
        createdAt: new Date()
      });

      // Get statistics
      const stats = await memoryRepository.getMemoryStats('test-conversation');

      expect(stats.factCount).toBe(1);
      expect(stats.summaryCount).toBe(1);
      expect(stats.relationshipCount).toBe(0);
      expect(stats.averageRelevanceScore).toBe(0.5);
    });
  });

  describe('Memory cleanup', () => {
    it('should provide cleanup functionality', async () => {
      // Add a test fact
      await memoryRepository.addFact('test-conversation', {
        content: 'Test fact',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.5,
        tags: ['test'],
        verified: false,
        references: ['msg1']
      });

      // Test cleanup function (may not delete anything with current date)
      const cleanupResult = await memoryRepository.cleanupOldMemory('test-conversation', 30);

      expect(cleanupResult).toBeDefined();
      expect(typeof cleanupResult.factsDeleted).toBe('number');
      expect(typeof cleanupResult.summariesDeleted).toBe('number');
      expect(typeof cleanupResult.relationshipsDeleted).toBe('number');
    });
  });
});