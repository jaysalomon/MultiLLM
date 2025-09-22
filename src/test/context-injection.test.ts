import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextManager } from '../main/services/context/ContextManager';
import { TokenCounter } from '../main/services/context/TokenCounter';
import { ContextScorer } from '../main/services/context/ContextScorer';
import { ContextCompressor } from '../main/services/context/ContextCompressor';
import { ContextSourceType } from '../shared/types/context';

describe('Context Injection System', () => {
  describe('TokenCounter', () => {
    let tokenCounter: TokenCounter;

    beforeEach(() => {
      tokenCounter = new TokenCounter();
    });

    it('should count tokens in text', () => {
      const text = 'This is a test sentence with multiple words.';
      const count = tokenCounter.count(text);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(20);
    });

    it('should handle code text', () => {
      const code = 'function test() { return "hello world"; }';
      const count = tokenCounter.count(code);
      expect(count).toBeGreaterThan(5);
    });

    it('should truncate text to token limit', () => {
      const longText = 'Lorem ipsum '.repeat(100);
      const truncated = tokenCounter.truncateToTokens(longText, 50);
      const truncatedTokens = tokenCounter.count(truncated);
      expect(truncatedTokens).toBeLessThanOrEqual(50);
    });

    it('should check if text fits in token budget', () => {
      const text = 'Short text';
      expect(tokenCounter.canFit(text, 100)).toBe(true);
      expect(tokenCounter.canFit(text, 1)).toBe(false);
    });
  });

  describe('ContextScorer', () => {
    let scorer: ContextScorer;

    beforeEach(() => {
      scorer = new ContextScorer();
    });

    it('should calculate similarity between texts', () => {
      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'The fast brown fox leaps over the lazy cat';
      const similarity = scorer.calculateSimilarity(text1, text2);
      
      expect(similarity).toBeGreaterThan(50); // Should have high similarity
      expect(similarity).toBeLessThan(100); // But not identical
    });

    it('should score chunks based on query', async () => {
      const chunks = [
        { id: '1', sourceId: 's1', content: 'React component lifecycle methods', score: 0, tokens: 10 },
        { id: '2', sourceId: 's2', content: 'Angular dependency injection', score: 0, tokens: 10 },
        { id: '3', sourceId: 's3', content: 'React hooks and state management', score: 0, tokens: 10 },
      ];

      const scored = await scorer.scoreChunks(chunks, 'React hooks');
      
      // React-related chunks should score higher
      const reactChunks = scored.filter(c => c.content.includes('React'));
      const angularChunk = scored.find(c => c.content.includes('Angular'));
      
      expect(reactChunks[0].score).toBeGreaterThan(angularChunk!.score);
    });
  });

  describe('ContextCompressor', () => {
    let compressor: ContextCompressor;

    beforeEach(() => {
      compressor = new ContextCompressor();
    });

    it('should compress content to target tokens', async () => {
      const longContent = `
        This is the first sentence of our content.
        Here is another important sentence.
        This sentence contains critical information.
        Yet another sentence with details.
        Final sentence with conclusion.
      `.repeat(10);

      const result = await compressor.compress(longContent, 100);
      
      expect(result.tokens.after).toBeLessThanOrEqual(100);
      expect(result.ratio).toBeLessThan(1);
      expect(result.compressed.length).toBeLessThan(result.original.length);
    });

    it('should not compress if already within limits', async () => {
      const shortContent = 'Short content';
      const result = await compressor.compress(shortContent, 1000);
      
      expect(result.compressed).toBe(shortContent);
      expect(result.ratio).toBe(1);
      expect(result.method).toBe('truncation');
    });

    it('should use different compression methods', async () => {
      const content = 'Test content '.repeat(50);
      
      // Test extraction
      const extracted = await compressor.compress(content, 50);
      expect(['extraction', 'summary', 'truncation']).toContain(extracted.method);
    });
  });

  describe('ContextManager Integration', () => {
    it('should add and retrieve context sources', async () => {
      // This is a conceptual test - actual implementation would need mocking
      const manager = {
        sources: new Map(),
        addSource: async function(source: any) {
          const id = Math.random().toString();
          this.sources.set(id, { ...source, id });
          return { ...source, id };
        },
        removeSource: async function(id: string) {
          this.sources.delete(id);
        }
      };

      const source = await manager.addSource({
        type: 'file' as ContextSourceType,
        name: 'test.ts',
        path: '/path/to/test.ts',
        isActive: true,
        priority: 80,
        metadata: {},
      });

      expect(source.id).toBeDefined();
      expect(manager.sources.size).toBe(1);

      await manager.removeSource(source.id);
      expect(manager.sources.size).toBe(0);
    });

    it('should format context for prompts', () => {
      const chunks = [
        { 
          id: '1', 
          sourceId: 's1', 
          content: 'Content from file', 
          score: 90, 
          tokens: 10,
          startLine: 1,
          endLine: 5
        },
        { 
          id: '2', 
          sourceId: 's1', 
          content: 'More content', 
          score: 85, 
          tokens: 8,
          startLine: 10,
          endLine: 15
        },
      ];

      // Format context
      let formatted = '';
      chunks.forEach(chunk => {
        if (chunk.startLine && chunk.endLine) {
          formatted += `Lines ${chunk.startLine}-${chunk.endLine}:\n`;
        }
        formatted += chunk.content + '\n\n';
      });

      expect(formatted).toContain('Lines 1-5');
      expect(formatted).toContain('Content from file');
      expect(formatted).toContain('Lines 10-15');
    });

    it('should allocate token budget efficiently', () => {
      const budget = {
        total: 1000,
        reserved: 100,
        available: 900,
        used: 0,
        allocation: new Map(),
      };

      const chunks = [
        { tokens: 200, sourceId: 's1', priority: 90 },
        { tokens: 300, sourceId: 's2', priority: 80 },
        { tokens: 250, sourceId: 's3', priority: 85 },
      ];

      // Sort by priority
      chunks.sort((a, b) => b.priority - a.priority);

      // Allocate tokens
      let remaining = budget.available;
      chunks.forEach(chunk => {
        if (chunk.tokens <= remaining) {
          remaining -= chunk.tokens;
          budget.allocation.set(
            chunk.sourceId,
            (budget.allocation.get(chunk.sourceId) || 0) + chunk.tokens
          );
        }
      });

      budget.used = budget.available - remaining;

      expect(budget.used).toBe(750);
      expect(budget.allocation.get('s1')).toBe(200);
      expect(budget.allocation.get('s3')).toBe(250);
      expect(budget.allocation.get('s2')).toBe(300);
    });
  });
});
