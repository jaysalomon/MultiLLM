import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryExtractor } from '../MemoryExtractor';
import type { MemoryExtractionRequest } from '../../types/memory';

describe('MemoryExtractor', () => {
  let memoryExtractor: MemoryExtractor;

  beforeEach(() => {
    memoryExtractor = new MemoryExtractor();
  });

  describe('extractMemory', () => {
    it('should extract facts from conversation messages', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Machine learning is a subset of artificial intelligence.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'Python is a popular programming language for data science.',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'facts'
      };

      const result = await memoryExtractor.extractMemory(request);

      expect(result).toBeDefined();
      expect(result.facts.length).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeGreaterThan(0);

      // Check that facts contain expected content
      const factContents = result.facts.map(f => f.content);
      expect(factContents.some(content => 
        content.includes('Machine learning') && content.includes('artificial intelligence')
      )).toBe(true);
    });

    it('should extract relationships from conversation messages', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Python is a programming language. JavaScript is a scripting language.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'React belongs to Facebook. Vue belongs to Evan You.',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'relationships'
      };

      const result = await memoryExtractor.extractMemory(request);

      expect(result).toBeDefined();
      expect(result.relationships.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);

      // Check for expected relationships
      const relationships = result.relationships;
      expect(relationships.some(rel => 
        rel.sourceEntity === 'Python' && rel.relationshipType === 'is_a'
      )).toBe(true);
      expect(relationships.some(rel => 
        rel.sourceEntity === 'React' && rel.relationshipType === 'belongs_to'
      )).toBe(true);
    });

    it('should generate summary for conversation messages', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Let\'s discuss machine learning algorithms.',
            sender: 'user',
            timestamp: new Date('2023-01-01T10:00:00Z')
          },
          {
            id: 'msg2',
            content: 'Sure! Machine learning includes supervised and unsupervised learning.',
            sender: 'assistant',
            timestamp: new Date('2023-01-01T10:01:00Z')
          },
          {
            id: 'msg3',
            content: 'What about deep learning and neural networks?',
            sender: 'user',
            timestamp: new Date('2023-01-01T10:02:00Z')
          },
          {
            id: 'msg4',
            content: 'Deep learning is a subset of machine learning using neural networks.',
            sender: 'assistant',
            timestamp: new Date('2023-01-01T10:03:00Z')
          }
        ],
        extractionType: 'summary'
      };

      const result = await memoryExtractor.extractMemory(request);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      if (result.summary) {
        expect(result.summary.summary).toContain('user');
        expect(result.summary.summary).toContain('assistant');
        expect(result.summary.messageCount).toBe(4);
        expect(result.summary.participants).toContain('user');
        expect(result.summary.participants).toContain('assistant');
        expect(result.summary.keyPoints.length).toBeGreaterThan(0);
      }
    });

    it('should extract all types when requested', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Python is a programming language that is popular for machine learning.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'TensorFlow is a library for machine learning.',
            sender: 'assistant',
            timestamp: new Date()
          },
          {
            id: 'msg3',
            content: 'TensorFlow belongs to Google.',
            sender: 'user',
            timestamp: new Date()
          }
        ],
        extractionType: 'all'
      };

      const result = await memoryExtractor.extractMemory(request);

      expect(result).toBeDefined();
      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle empty messages gracefully', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [],
        extractionType: 'all'
      };

      const result = await memoryExtractor.extractMemory(request);

      expect(result).toBeDefined();
      expect(result.facts).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.summary).toBeUndefined();
      expect(result.confidence).toBe(0);
    });

    it('should handle very short messages', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test-conversation',
        messages: [
          {
            id: 'msg1',
            content: 'Hi',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'Hello',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'facts'
      };

      const result = await memoryExtractor.extractMemory(request);

      expect(result).toBeDefined();
      expect(result.facts).toEqual([]); // Should skip very short messages
      expect(result.confidence).toBe(0);
    });
  });

  describe('fact extraction patterns', () => {
    it('should extract definition facts', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [{
          id: 'msg1',
          content: 'Machine learning means using algorithms to learn from data.',
          sender: 'user',
          timestamp: new Date()
        }],
        extractionType: 'facts'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      expect(result.facts.some(fact => 
        fact.content.includes('means') && fact.tags.includes('definition')
      )).toBe(true);
    });

    it('should extract numerical facts', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [{
          id: 'msg1',
          content: 'The model achieved 95% accuracy on the test set.',
          sender: 'user',
          timestamp: new Date()
        }],
        extractionType: 'facts'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      expect(result.facts.some(fact => 
        fact.content.includes('95%') && fact.tags.includes('numerical')
      )).toBe(true);
    });

    it('should extract causal relationships', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [{
          id: 'msg1',
          content: 'Overfitting occurs because the model memorizes training data.',
          sender: 'user',
          timestamp: new Date()
        }],
        extractionType: 'facts'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      expect(result.facts.some(fact => 
        fact.content.includes('because') && fact.tags.includes('causal')
      )).toBe(true);
    });
  });

  describe('relationship extraction patterns', () => {
    it('should extract "is a" relationships', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [{
          id: 'msg1',
          content: 'Python is a programming language.',
          sender: 'user',
          timestamp: new Date()
        }],
        extractionType: 'relationships'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      expect(result.relationships.some(rel => 
        rel.sourceEntity === 'Python' && 
        rel.relationshipType === 'is_a' &&
        rel.targetEntity === 'programming'
      )).toBe(true);
    });

    it('should extract "has" relationships', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [{
          id: 'msg1',
          content: 'Python has excellent libraries.',
          sender: 'user',
          timestamp: new Date()
        }],
        extractionType: 'relationships'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      expect(result.relationships.some(rel => 
        rel.sourceEntity === 'Python' && 
        rel.relationshipType === 'has'
      )).toBe(true);
    });

    it('should extract "belongs to" relationships', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [{
          id: 'msg1',
          content: 'TensorFlow belongs to Google.',
          sender: 'user',
          timestamp: new Date()
        }],
        extractionType: 'relationships'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      expect(result.relationships.some(rel => 
        rel.sourceEntity === 'TensorFlow' && 
        rel.relationshipType === 'belongs_to' &&
        rel.targetEntity === 'Google'
      )).toBe(true);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate similar facts', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [
          {
            id: 'msg1',
            content: 'Python is a programming language.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'Python is a programming language used for development.',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'facts'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      // Should have fewer facts than messages due to deduplication
      const pythonFacts = result.facts.filter(fact => 
        fact.content.toLowerCase().includes('python')
      );
      
      // Should have facts about Python
      expect(pythonFacts.length).toBeGreaterThan(0);
      // Check that at least one fact has multiple references (indicating deduplication)
      const hasMultipleReferences = pythonFacts.some(fact => fact.references.length > 1);
      expect(hasMultipleReferences || pythonFacts.length === 1).toBe(true);
    });

    it('should deduplicate identical relationships', async () => {
      const request: MemoryExtractionRequest = {
        conversationId: 'test',
        messages: [
          {
            id: 'msg1',
            content: 'Python is a language.',
            sender: 'user',
            timestamp: new Date()
          },
          {
            id: 'msg2',
            content: 'Python is a language for programming.',
            sender: 'assistant',
            timestamp: new Date()
          }
        ],
        extractionType: 'relationships'
      };

      const result = await memoryExtractor.extractMemory(request);
      
      const pythonRelationships = result.relationships.filter(rel => 
        rel.sourceEntity === 'Python' && rel.relationshipType === 'is_a'
      );
      
      // Should merge identical relationships
      expect(pythonRelationships.length).toBe(1);
      if (pythonRelationships.length > 0) {
        expect(pythonRelationships[0].evidence.length).toBeGreaterThan(1);
      }
    });
  });
});