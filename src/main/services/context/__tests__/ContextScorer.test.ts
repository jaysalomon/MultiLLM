import { describe, it, expect, beforeEach } from 'vitest';
import { ContextScorer } from '../ContextScorer';
import { ContextChunk } from '../../../../shared/types/context';

describe('ContextScorer', () => {
  let scorer: ContextScorer;

  beforeEach(() => {
    scorer = new ContextScorer();
  });

  describe('scoreChunks', () => {
    it('should return empty array for empty chunks', async () => {
      const result = await scorer.scoreChunks([], 'test query');
      expect(result).toEqual([]);
    });

    it('should return original chunks for empty query', async () => {
      const chunks: ContextChunk[] = [
        {
          id: '1',
          sourceId: 'source1',
          content: 'This is test content',
          score: 0,
          tokens: 4
        }
      ];

      const result = await scorer.scoreChunks(chunks, '');
      expect(result).toEqual(chunks);
    });

    it('should score chunks based on relevance to query', async () => {
      const chunks: ContextChunk[] = [
        {
          id: '1',
          sourceId: 'source1',
          content: 'JavaScript function implementation with async await',
          score: 0,
          tokens: 7
        },
        {
          id: '2',
          sourceId: 'source2',
          content: 'Python data analysis using pandas and numpy',
          score: 0,
          tokens: 7
        },
        {
          id: '3',
          sourceId: 'source3',
          content: 'JavaScript promises and callback functions',
          score: 0,
          tokens: 6
        }
      ];

      const result = await scorer.scoreChunks(chunks, 'JavaScript function');
      
      expect(result).toHaveLength(3);
      // JavaScript-related chunks should score higher than Python chunk
      const jsChunks = result.filter(chunk => chunk.content.includes('JavaScript'));
      const pythonChunk = result.find(chunk => chunk.content.includes('Python'));
      
      expect(jsChunks.length).toBeGreaterThanOrEqual(1);
      expect(pythonChunk).toBeDefined();
      
      // At least one JavaScript chunk should score higher than the Python chunk
      const maxJsScore = Math.max(...jsChunks.map(chunk => chunk.score));
      expect(maxJsScore).toBeGreaterThan(pythonChunk!.score);

    });

    it('should return chunks sorted by score descending', async () => {
      const chunks: ContextChunk[] = [
        {
          id: '1',
          sourceId: 'source1',
          content: 'Unrelated content about cooking',
          score: 0,
          tokens: 5
        },
        {
          id: '2',
          sourceId: 'source2',
          content: 'Machine learning algorithms and neural networks',
          score: 0,
          tokens: 6
        },
        {
          id: '3',
          sourceId: 'source3',
          content: 'Deep learning with neural networks and AI',
          score: 0,
          tokens: 7
        }
      ];

      const result = await scorer.scoreChunks(chunks, 'neural networks machine learning');
      
      expect(result).toHaveLength(3);
      
      // Verify descending order
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
      }
    });

    it('should handle chunks with special characters and code', async () => {
      const chunks: ContextChunk[] = [
        {
          id: '1',
          sourceId: 'source1',
          content: 'const fetchData = async () => { return await api.get("/data"); }',
          score: 0,
          tokens: 15
        },
        {
          id: '2',
          sourceId: 'source2',
          content: 'Regular text without any code or special syntax',
          score: 0,
          tokens: 9
        }
      ];

      const result = await scorer.scoreChunks(chunks, 'async function api');
      
      expect(result).toHaveLength(2);
      expect(result[0].content).toContain('async');
    });

    it('should round scores to 2 decimal places', async () => {
      const chunks: ContextChunk[] = [
        {
          id: '1',
          sourceId: 'source1',
          content: 'Test content for scoring precision',
          score: 0,
          tokens: 6
        }
      ];

      const result = await scorer.scoreChunks(chunks, 'test content');
      
      expect(result[0].score).toEqual(Math.round(result[0].score * 100) / 100);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 0 for completely different texts', () => {
      const similarity = scorer.calculateSimilarity('apple banana', 'car truck');
      expect(similarity).toBe(0);
    });

    it('should return 100 for identical texts', () => {
      const text = 'hello world test';
      const similarity = scorer.calculateSimilarity(text, text);
      expect(similarity).toBe(100);
    });

    it('should return partial similarity for overlapping texts', () => {
      const similarity = scorer.calculateSimilarity('hello world', 'hello universe');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(100);
    });

    it('should handle empty strings', () => {
      expect(scorer.calculateSimilarity('', '')).toBe(0);
      expect(scorer.calculateSimilarity('test', '')).toBe(0);
      expect(scorer.calculateSimilarity('', 'test')).toBe(0);
    });

    it('should be case insensitive', () => {
      const similarity1 = scorer.calculateSimilarity('Hello World', 'hello world');
      const similarity2 = scorer.calculateSimilarity('hello world', 'hello world');
      expect(similarity1).toBe(similarity2);
    });
  });
});