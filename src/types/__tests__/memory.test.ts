import { describe, it, expect, beforeEach } from 'vitest';
import type {
  SharedMemoryContext,
  MemoryFact,
  ConversationSummary,
  EntityRelationship,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryUpdateNotification,
  MemoryExtractionRequest,
  MemoryExtractionResult,
} from '../memory';

describe('Memory Types', () => {
  let mockFact: MemoryFact;
  let mockSummary: ConversationSummary;
  let mockRelationship: EntityRelationship;

  beforeEach(() => {
    mockFact = {
      id: 'fact-1',
      content: 'The user prefers dark mode for the interface',
      source: 'user',
      timestamp: new Date('2024-01-01T00:00:00.000Z'),
      relevanceScore: 0.9,
      tags: ['preference', 'ui'],
      verified: true,
      references: ['msg-1', 'msg-5'],
    };

    mockSummary = {
      id: 'summary-1',
      timeRange: {
        start: new Date('2024-01-01T00:00:00.000Z'),
        end: new Date('2024-01-01T01:00:00.000Z'),
      },
      summary: 'Discussion about UI preferences and accessibility features',
      keyPoints: ['User prefers dark mode', 'Accessibility is important', 'Font size should be adjustable'],
      participants: ['user', 'gpt-4', 'claude-3'],
      messageCount: 25,
      createdBy: 'gpt-4',
      createdAt: new Date('2024-01-01T01:00:00.000Z'),
    };

    mockRelationship = {
      id: 'rel-1',
      sourceEntity: 'dark mode',
      targetEntity: 'user preference',
      relationshipType: 'is_a',
      confidence: 0.95,
      evidence: ['msg-1', 'msg-3'],
      createdBy: 'claude-3',
      createdAt: new Date('2024-01-01T00:30:00.000Z'),
    };
  });

  describe('SharedMemoryContext', () => {
    it('should create a valid shared memory context', () => {
      const context: SharedMemoryContext = {
        conversationId: 'conv-1',
        facts: [mockFact],
        summaries: [mockSummary],
        relationships: [mockRelationship],
        lastUpdated: new Date('2024-01-01T01:00:00.000Z'),
        version: 1,
      };

      expect(context.conversationId).toBe('conv-1');
      expect(context.facts).toHaveLength(1);
      expect(context.summaries).toHaveLength(1);
      expect(context.relationships).toHaveLength(1);
      expect(context.lastUpdated).toEqual(new Date('2024-01-01T01:00:00.000Z'));
      expect(context.version).toBe(1);
    });

    it('should create an empty shared memory context', () => {
      const context: SharedMemoryContext = {
        conversationId: 'conv-2',
        facts: [],
        summaries: [],
        relationships: [],
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
        version: 0,
      };

      expect(context.facts).toHaveLength(0);
      expect(context.summaries).toHaveLength(0);
      expect(context.relationships).toHaveLength(0);
      expect(context.version).toBe(0);
    });
  });

  describe('MemoryFact', () => {
    it('should create a valid memory fact', () => {
      expect(mockFact.id).toBe('fact-1');
      expect(mockFact.content).toBe('The user prefers dark mode for the interface');
      expect(mockFact.source).toBe('user');
      expect(mockFact.relevanceScore).toBe(0.9);
      expect(mockFact.tags).toEqual(['preference', 'ui']);
      expect(mockFact.verified).toBe(true);
      expect(mockFact.references).toEqual(['msg-1', 'msg-5']);
    });

    it('should create a fact with embedding vector', () => {
      const factWithEmbedding: MemoryFact = {
        ...mockFact,
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      };

      expect(factWithEmbedding.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should create an unverified fact', () => {
      const unverifiedFact: MemoryFact = {
        id: 'fact-2',
        content: 'The user might prefer light theme',
        source: 'gpt-4',
        timestamp: new Date('2024-01-01T00:05:00.000Z'),
        relevanceScore: 0.6,
        tags: ['speculation', 'ui'],
        verified: false,
        references: ['msg-10'],
      };

      expect(unverifiedFact.verified).toBe(false);
      expect(unverifiedFact.source).toBe('gpt-4');
      expect(unverifiedFact.relevanceScore).toBe(0.6);
    });
  });

  describe('ConversationSummary', () => {
    it('should create a valid conversation summary', () => {
      expect(mockSummary.id).toBe('summary-1');
      expect(mockSummary.summary).toBe('Discussion about UI preferences and accessibility features');
      expect(mockSummary.keyPoints).toHaveLength(3);
      expect(mockSummary.participants).toEqual(['user', 'gpt-4', 'claude-3']);
      expect(mockSummary.messageCount).toBe(25);
      expect(mockSummary.createdBy).toBe('gpt-4');
    });

    it('should create a summary with embedding', () => {
      const summaryWithEmbedding: ConversationSummary = {
        ...mockSummary,
        embedding: [0.8, 0.7, 0.6, 0.5, 0.4],
      };

      expect(summaryWithEmbedding.embedding).toEqual([0.8, 0.7, 0.6, 0.5, 0.4]);
    });
  });

  describe('EntityRelationship', () => {
    it('should create a valid entity relationship', () => {
      expect(mockRelationship.id).toBe('rel-1');
      expect(mockRelationship.sourceEntity).toBe('dark mode');
      expect(mockRelationship.targetEntity).toBe('user preference');
      expect(mockRelationship.relationshipType).toBe('is_a');
      expect(mockRelationship.confidence).toBe(0.95);
      expect(mockRelationship.evidence).toEqual(['msg-1', 'msg-3']);
      expect(mockRelationship.createdBy).toBe('claude-3');
    });

    it('should create different relationship types', () => {
      const partOfRelationship: EntityRelationship = {
        id: 'rel-2',
        sourceEntity: 'font size',
        targetEntity: 'accessibility features',
        relationshipType: 'part_of',
        confidence: 0.85,
        evidence: ['msg-7'],
        createdBy: 'gpt-4',
        createdAt: new Date('2024-01-01T00:45:00.000Z'),
      };

      expect(partOfRelationship.relationshipType).toBe('part_of');
      expect(partOfRelationship.confidence).toBe(0.85);
    });
  });

  describe('MemorySearchQuery', () => {
    it('should create a basic search query', () => {
      const query: MemorySearchQuery = {
        query: 'user preferences',
        type: 'facts',
        limit: 10,
      };

      expect(query.query).toBe('user preferences');
      expect(query.type).toBe('facts');
      expect(query.limit).toBe(10);
    });

    it('should create a comprehensive search query', () => {
      const query: MemorySearchQuery = {
        query: 'dark mode accessibility',
        type: 'all',
        limit: 20,
        minRelevanceScore: 0.7,
        timeRange: {
          start: new Date('2024-01-01T00:00:00.000Z'),
          end: new Date('2024-01-01T12:00:00.000Z'),
        },
        tags: ['ui', 'preference'],
        sources: ['user', 'gpt-4'],
      };

      expect(query.query).toBe('dark mode accessibility');
      expect(query.type).toBe('all');
      expect(query.minRelevanceScore).toBe(0.7);
      expect(query.timeRange?.start).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(query.timeRange?.end).toEqual(new Date('2024-01-01T12:00:00.000Z'));
      expect(query.tags).toEqual(['ui', 'preference']);
      expect(query.sources).toEqual(['user', 'gpt-4']);
    });
  });

  describe('MemorySearchResult', () => {
    it('should create a valid search result', () => {
      const result: MemorySearchResult = {
        facts: [mockFact],
        summaries: [mockSummary],
        relationships: [mockRelationship],
        totalResults: 3,
        searchTime: 150,
      };

      expect(result.facts).toHaveLength(1);
      expect(result.summaries).toHaveLength(1);
      expect(result.relationships).toHaveLength(1);
      expect(result.totalResults).toBe(3);
      expect(result.searchTime).toBe(150);
    });

    it('should create an empty search result', () => {
      const result: MemorySearchResult = {
        facts: [],
        summaries: [],
        relationships: [],
        totalResults: 0,
        searchTime: 50,
      };

      expect(result.facts).toHaveLength(0);
      expect(result.summaries).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });
  });

  describe('MemoryUpdateNotification', () => {
    it('should create a fact added notification', () => {
      const notification: MemoryUpdateNotification = {
        type: 'fact_added',
        conversationId: 'conv-1',
        data: mockFact,
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        source: 'gpt-4',
      };

      expect(notification.type).toBe('fact_added');
      expect(notification.conversationId).toBe('conv-1');
      expect(notification.data).toEqual(mockFact);
      expect(notification.source).toBe('gpt-4');
    });

    it('should create a summary created notification', () => {
      const notification: MemoryUpdateNotification = {
        type: 'summary_created',
        conversationId: 'conv-1',
        data: mockSummary,
        timestamp: new Date('2024-01-01T01:00:00.000Z'),
        source: 'claude-3',
      };

      expect(notification.type).toBe('summary_created');
      expect(notification.data).toEqual(mockSummary);
      expect(notification.source).toBe('claude-3');
    });
  });

  describe('MemoryExtractionRequest', () => {
    it('should create a valid extraction request', () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'conv-1',
        messages: [
          {
            id: 'msg-1',
            content: 'I prefer dark mode for better readability',
            sender: 'user',
            timestamp: new Date('2024-01-01T00:00:00.000Z'),
          },
          {
            id: 'msg-2',
            content: 'Dark mode is indeed better for eye strain',
            sender: 'gpt-4',
            timestamp: new Date('2024-01-01T00:01:00.000Z'),
          },
        ],
        extractionType: 'facts',
      };

      expect(request.conversationId).toBe('conv-1');
      expect(request.messages).toHaveLength(2);
      expect(request.extractionType).toBe('facts');
      expect(request.context).toBeUndefined();
    });

    it('should create an extraction request with context', () => {
      const context: SharedMemoryContext = {
        conversationId: 'conv-1',
        facts: [mockFact],
        summaries: [],
        relationships: [],
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
        version: 1,
      };

      const request: MemoryExtractionRequest = {
        conversationId: 'conv-1',
        messages: [],
        extractionType: 'all',
        context,
      };

      expect(request.extractionType).toBe('all');
      expect(request.context).toEqual(context);
    });
  });

  describe('MemoryExtractionResult', () => {
    it('should create a valid extraction result', () => {
      const result: MemoryExtractionResult = {
        facts: [
          {
            content: 'User prefers dark mode',
            source: 'user',
            timestamp: new Date('2024-01-01T00:00:00.000Z'),
            relevanceScore: 0.9,
            tags: ['preference'],
            verified: true,
            references: ['msg-1'],
          },
        ],
        relationships: [
          {
            sourceEntity: 'dark mode',
            targetEntity: 'user preference',
            relationshipType: 'is_a',
            confidence: 0.9,
            evidence: ['msg-1'],
            createdBy: 'gpt-4',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        summary: {
          timeRange: {
            start: new Date('2024-01-01T00:00:00.000Z'),
            end: new Date('2024-01-01T00:05:00.000Z'),
          },
          summary: 'User expressed preference for dark mode',
          keyPoints: ['Dark mode preference'],
          participants: ['user', 'gpt-4'],
          messageCount: 2,
          createdBy: 'gpt-4',
          createdAt: new Date('2024-01-01T00:05:00.000Z'),
        },
        confidence: 0.85,
        processingTime: 500,
      };

      expect(result.facts).toHaveLength(1);
      expect(result.relationships).toHaveLength(1);
      expect(result.summary).toBeDefined();
      expect(result.confidence).toBe(0.85);
      expect(result.processingTime).toBe(500);
    });
  });
});