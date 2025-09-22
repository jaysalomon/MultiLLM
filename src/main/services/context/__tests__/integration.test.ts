import { describe, it, expect, beforeEach } from 'vitest';
import { ContextScorer } from '../ContextScorer';
import { ContextCompressor } from '../ContextCompressor';
import { TokenCounter } from '../TokenCounter';
import { ContextChunk } from '../../../../shared/types/context';

describe('Context Utilities Integration', () => {
  let scorer: ContextScorer;
  let compressor: ContextCompressor;
  let counter: TokenCounter;

  beforeEach(() => {
    scorer = new ContextScorer();
    compressor = new ContextCompressor();
    counter = new TokenCounter();
  });

  it('should work together to score, compress, and count tokens', async () => {
    // Create test chunks with varying relevance
    const chunks: ContextChunk[] = [
      {
        id: '1',
        sourceId: 'source1',
        content: 'JavaScript async functions are powerful tools for handling asynchronous operations in modern web development.',
        score: 0,
        tokens: 0
      },
      {
        id: '2',
        sourceId: 'source2',
        content: 'Python data science libraries like pandas and numpy provide excellent tools for data analysis and manipulation.',
        score: 0,
        tokens: 0
      },
      {
        id: '3',
        sourceId: 'source3',
        content: 'Machine learning algorithms can be implemented in both JavaScript and Python, each with their own advantages.',
        score: 0,
        tokens: 0
      }
    ];

    // Add token counts to chunks
    chunks.forEach(chunk => {
      chunk.tokens = counter.count(chunk.content);
    });

    // Score chunks based on query
    const query = 'JavaScript async programming';
    const scoredChunks = await scorer.scoreChunks(chunks, query);

    // Verify scoring worked
    expect(scoredChunks).toHaveLength(3);
    expect(scoredChunks[0].score).toBeGreaterThan(0);

    // Find the most relevant chunk
    const topChunk = scoredChunks[0];
    expect(topChunk.content).toContain('JavaScript');

    // Compress the top chunk if it's too long
    const maxTokens = 15;
    if (topChunk.tokens > maxTokens) {
      const compressionResult = await compressor.compress(topChunk.content, maxTokens);
      
      expect(compressionResult.tokens.after).toBeLessThanOrEqual(maxTokens);
      expect(compressionResult.compressed.length).toBeLessThan(topChunk.content.length);
      
      // Verify token counter agrees with compression result
      const actualTokens = counter.count(compressionResult.compressed);
      expect(Math.abs(actualTokens - compressionResult.tokens.after)).toBeLessThanOrEqual(2); // Allow small variance
    }
  });

  it('should handle code content across all utilities', async () => {
    const codeChunk: ContextChunk = {
      id: 'code1',
      sourceId: 'codeSource',
      content: `
        async function fetchUserData(userId) {
          try {
            const response = await fetch(\`/api/users/\${userId}\`);
            const userData = await response.json();
            return userData;
          } catch (error) {
            console.error('Failed to fetch user data:', error);
            throw error;
          }
        }
      `,
      score: 0,
      tokens: 0
    };

    // Count tokens in code
    codeChunk.tokens = counter.count(codeChunk.content);
    expect(codeChunk.tokens).toBeGreaterThan(20);

    // Score against code-related query
    const scoredChunks = await scorer.scoreChunks([codeChunk], 'async function fetch API');
    expect(scoredChunks[0].score).toBeGreaterThan(30); // Adjusted expectation

    // Compress if needed
    const compressionResult = await compressor.compress(codeChunk.content, 25);
    expect(compressionResult.tokens.after).toBeLessThanOrEqual(25);
    // Should contain some code-related content
    expect(compressionResult.compressed.length).toBeGreaterThan(0);
    expect(compressionResult.compressed).toMatch(/\b(async|function|const|await|try|catch)\b/);
  });

  it('should maintain consistency between token counting and compression', async () => {
    const testContent = `
      This is a comprehensive test of the token counting and compression utilities.
      The content includes multiple sentences with various technical terms.
      We want to ensure that the token counter and compressor work together seamlessly.
      The compression algorithm should respect the token limits set by the counter.
      This integration test verifies that all components work harmoniously together.
    `.trim();

    // Count original tokens
    const originalTokens = counter.count(testContent);
    expect(originalTokens).toBeGreaterThan(30);

    // Compress to half the original size
    const targetTokens = Math.floor(originalTokens / 2);
    const compressionResult = await compressor.compress(testContent, targetTokens);

    // Verify compression respects token limit
    expect(compressionResult.tokens.after).toBeLessThanOrEqual(targetTokens);

    // Verify token counter agrees with compression result
    const actualTokens = counter.count(compressionResult.compressed);
    expect(Math.abs(actualTokens - compressionResult.tokens.after)).toBeLessThanOrEqual(3); // Allow small variance

    // Verify we can truncate to exact token limits
    const truncated = counter.truncateToTokens(testContent, targetTokens);
    const truncatedTokens = counter.count(truncated);
    expect(truncatedTokens).toBeLessThanOrEqual(targetTokens);
  });

  it('should handle edge cases consistently', async () => {
    // Empty content
    expect(counter.count('')).toBe(0);
    expect(await scorer.scoreChunks([], 'test')).toEqual([]);
    
    const emptyCompression = await compressor.compress('', 10);
    expect(emptyCompression.compressed).toBe('');
    expect(emptyCompression.tokens.before).toBe(0);
    expect(emptyCompression.tokens.after).toBe(0);

    // Very short content
    const shortContent = 'Hi';
    const shortTokens = counter.count(shortContent);
    const shortCompression = await compressor.compress(shortContent, 100);
    expect(shortCompression.compressed).toBe(shortContent);
    expect(shortCompression.tokens.before).toBe(shortTokens);
    expect(shortCompression.tokens.after).toBe(shortTokens);
  });
});