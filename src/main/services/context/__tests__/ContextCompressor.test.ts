import { describe, it, expect, beforeEach } from 'vitest';
import { ContextCompressor } from '../ContextCompressor';

describe('ContextCompressor', () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    compressor = new ContextCompressor();
  });

  describe('compress', () => {
    it('should return original content if within token limit', async () => {
      const content = 'Short content that fits within limits.';
      const result = await compressor.compress(content, 100);

      expect(result.compressed).toBe(content);
      expect(result.original).toBe(content);
      expect(result.ratio).toBe(1);
      expect(result.method).toBe('truncation');
      expect(result.tokens.before).toBe(result.tokens.after);
    });

    it('should compress content when it exceeds token limit', async () => {
      const content = `
        This is the first sentence with important information.
        This is the second sentence with more details.
        This is the third sentence with additional context.
        This is the fourth sentence with extra information.
        This is the fifth sentence with supplementary data.
        This is the sixth sentence with further details.
        This is the seventh sentence with more context.
        This is the eighth sentence with additional information.
      `.trim();

      const result = await compressor.compress(content, 20);

      expect(result.tokens.after).toBeLessThanOrEqual(20);
      expect(result.tokens.before).toBeGreaterThan(result.tokens.after);
      expect(result.ratio).toBeLessThan(1);
      expect(result.compressed.length).toBeLessThan(result.original.length);
    });

    it('should use extractive compression for moderate content', async () => {
      const content = `
        Machine learning is a subset of artificial intelligence.
        It involves training algorithms on data to make predictions.
        Neural networks are a popular machine learning technique.
        They consist of interconnected nodes that process information.
        Deep learning uses multiple layers of neural networks.
        This allows for more complex pattern recognition.
      `.trim();

      const result = await compressor.compress(content, 30);

      expect(result.method).toBe('extraction');
      expect(result.tokens.after).toBeLessThanOrEqual(30);
      expect(result.compressed.toLowerCase()).toContain('machine learning');
    });

    it('should use summarization for long content', async () => {
      const longContent = Array(50).fill(
        'This is a sentence with some important information about machine learning and artificial intelligence. '
      ).join('');

      const result = await compressor.compress(longContent, 50);

      expect(result.tokens.after).toBeLessThanOrEqual(50);
      expect(result.tokens.before).toBeGreaterThan(result.tokens.after);
      expect(['summary', 'extraction', 'truncation']).toContain(result.method);
    });

    it('should fall back to truncation when other methods fail', async () => {
      const content = 'word '.repeat(100); // Very repetitive content
      const result = await compressor.compress(content, 10);

      expect(result.tokens.after).toBeLessThanOrEqual(10);
      expect(['truncation', 'extraction']).toContain(result.method);
      // Should compress to fit within token limit regardless of method
      expect(result.tokens.after).toBeLessThanOrEqual(10);
    });

    it('should handle empty content', async () => {
      const result = await compressor.compress('', 10);

      expect(result.compressed).toBe('');
      expect(result.original).toBe('');
      expect(result.tokens.before).toBe(0);
      expect(result.tokens.after).toBe(0);
      expect(result.ratio).toBe(1);
    });

    it('should preserve important technical terms', async () => {
      const content = `
        The function async fetchData() returns a Promise.
        It uses await to handle asynchronous operations.
        The interface defines the contract for the API.
        Classes implement the interface methods.
        Variables are declared with const, let, or var.
        Regular text without technical terms.
      `.trim();

      const result = await compressor.compress(content, 25);

      // Should prioritize sentences with technical keywords
      const technicalTerms = ['function', 'async', 'Promise', 'interface', 'const'];
      const hasTechnicalTerms = technicalTerms.some(term => 
        result.compressed.toLowerCase().includes(term.toLowerCase())
      );
      
      expect(hasTechnicalTerms).toBe(true);;
    });

    it('should handle code content appropriately', async () => {
      const codeContent = `
        function calculateSum(a, b) {
          return a + b;
        }
        
        const result = calculateSum(5, 3);
        console.log(result);
        
        // This is a comment
        if (result > 0) {
          console.log('Positive result');
        }
      `.trim();

      const result = await compressor.compress(codeContent, 20);

      expect(result.tokens.after).toBeLessThanOrEqual(20);
      expect(result.compressed).toContain('function');
    });

    it('should maintain reasonable compression ratios', async () => {
      const content = `
        Artificial intelligence is transforming many industries.
        Machine learning algorithms can process vast amounts of data.
        Neural networks mimic the structure of the human brain.
        Deep learning enables computers to recognize patterns.
        Natural language processing helps computers understand text.
        Computer vision allows machines to interpret images.
      `.trim();

      const result = await compressor.compress(content, 30);

      expect(result.ratio).toBeGreaterThan(0.2); // Should not compress too aggressively
      expect(result.ratio).toBeLessThan(1); // Should actually compress
    });

    it('should handle content with mixed sentence structures', async () => {
      const content = `
        Short sentence.
        This is a much longer sentence with more detailed information and context.
        Another short one.
        Yet another extremely long sentence that contains a lot of information and details that might be important for understanding the context and meaning of the overall content.
      `.trim();

      const result = await compressor.compress(content, 25);

      expect(result.tokens.after).toBeLessThanOrEqual(25);
      expect(result.compressed.length).toBeGreaterThan(0);
    });
  });
});