import { describe, it, expect, beforeEach } from 'vitest';
import { TokenCounter } from '../TokenCounter';

describe('TokenCounter', () => {
  let counter: TokenCounter;

  beforeEach(() => {
    counter = new TokenCounter();
  });

  describe('count', () => {
    it('should return 0 for empty or null input', () => {
      expect(counter.count('')).toBe(0);
      expect(counter.count('   ')).toBe(0);
      expect(counter.count(null as any)).toBe(0);
      expect(counter.count(undefined as any)).toBe(0);
    });

    it('should count simple text tokens', () => {
      expect(counter.count('hello')).toBeGreaterThanOrEqual(1);
      expect(counter.count('hello world')).toBeGreaterThanOrEqual(2);
      expect(counter.count('the quick brown fox')).toBeGreaterThanOrEqual(4);
    });

    it('should handle punctuation', () => {
      expect(counter.count('Hello, world!')).toBeGreaterThan(2);
      expect(counter.count('Yes, no, maybe.')).toBeGreaterThan(3);
    });

    it('should count code tokens differently', () => {
      const codeText = `
        function hello() {
          return "world";
        }
      `;
      const regularText = 'function hello return world';
      
      const codeTokens = counter.count(codeText);
      const regularTokens = counter.count(regularText);
      
      expect(codeTokens).toBeGreaterThan(regularTokens);
    });

    it('should recognize and count code patterns', () => {
      const jsCode = 'const fetchData = async () => { return await api.get("/data"); }';
      const tokens = counter.count(jsCode);
      
      expect(tokens).toBeGreaterThan(10); // Should account for operators and keywords
    });

    it('should handle structured data like JSON', () => {
      const jsonText = '{"name": "John", "age": 30, "city": "New York"}';
      const tokens = counter.count(jsonText);
      
      expect(tokens).toBeGreaterThan(8); // Should count braces, quotes, etc.
    });

    it('should count multiline content', () => {
      const multilineText = `
        Line one with some content.
        Line two with more content.
        Line three with additional content.
      `;
      
      const tokens = counter.count(multilineText);
      expect(tokens).toBeGreaterThan(10);
    });

    it('should handle common English words efficiently', () => {
      const commonWords = 'the and for are but not you all can had her was one our';
      const tokens = counter.count(commonWords);
      
      expect(tokens).toBeGreaterThanOrEqual(13); // Should be close to word count for common words
      expect(tokens).toBeLessThanOrEqual(15); // But not too much higher
    });

    it('should count longer words with more tokens', () => {
      const shortWord = counter.count('cat');
      const longWord = counter.count('extraordinary');
      
      expect(longWord).toBeGreaterThan(shortWord);
    });

    it('should handle special characters in code', () => {
      const codeWithSpecialChars = 'array[index] = {key: value, ...spread};';
      const tokens = counter.count(codeWithSpecialChars);
      
      expect(tokens).toBeGreaterThan(8);
    });

    it('should detect and handle XML/HTML content', () => {
      const xmlContent = '<root><item id="1">Content</item></root>';
      const tokens = counter.count(xmlContent);
      
      expect(tokens).toBeGreaterThan(6);
    });
  });

  describe('remaining', () => {
    it('should calculate remaining tokens correctly', () => {
      const helloWorldTokens = counter.count('hello world');
      expect(counter.remaining('hello world', 10)).toBe(10 - helloWorldTokens);
      expect(counter.remaining('hello world', 2)).toBe(0);
      expect(counter.remaining('hello world', 1)).toBe(0);
    });

    it('should never return negative values', () => {
      expect(counter.remaining('hello world test', 1)).toBe(0);
    });
  });

  describe('canFit', () => {
    it('should return true when content fits within limit', () => {
      expect(counter.canFit('hello', 5)).toBe(true);
      expect(counter.canFit('hello world', 5)).toBe(true);
    });

    it('should return false when content exceeds limit', () => {
      expect(counter.canFit('hello world test', 2)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(counter.canFit('', 0)).toBe(true);
      expect(counter.canFit('hello', 0)).toBe(false);
    });
  });

  describe('truncateToTokens', () => {
    it('should return original text if within limit', () => {
      const text = 'hello world';
      expect(counter.truncateToTokens(text, 10)).toBe(text);
    });

    it('should truncate text to fit token limit', () => {
      const text = 'This is a long sentence with many words that should be truncated.';
      const truncated = counter.truncateToTokens(text, 5);
      
      expect(counter.count(truncated)).toBeLessThanOrEqual(5);
      expect(truncated.length).toBeLessThan(text.length);
    });

    it('should try to end at natural boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const truncated = counter.truncateToTokens(text, 8);
      
      // Should prefer ending at sentence boundary
      expect(truncated.endsWith('.')).toBe(true);
    });

    it('should handle code content', () => {
      const codeText = `
        function test() {
          console.log("hello");
          return true;
        }
      `;
      
      const truncated = counter.truncateToTokens(codeText, 10);
      expect(counter.count(truncated)).toBeLessThanOrEqual(10);
    });

    it('should handle very short limits', () => {
      const text = 'hello world test';
      const truncated = counter.truncateToTokens(text, 1);
      
      expect(counter.count(truncated)).toBeLessThanOrEqual(1);
      expect(truncated.length).toBeGreaterThan(0);
    });

    it('should prefer word boundaries when possible', () => {
      const text = 'hello world testing truncation';
      const truncated = counter.truncateToTokens(text, 3);
      
      // Should not cut in the middle of a word if possible
      expect(truncated.split(' ').every(word => word.length > 0)).toBe(true);
    });
  });

  describe('estimateTokensFromChars', () => {
    it('should provide reasonable estimates', () => {
      expect(counter.estimateTokensFromChars(100)).toBe(25); // 100/4
      expect(counter.estimateTokensFromChars(0)).toBe(0);
      expect(counter.estimateTokensFromChars(1)).toBe(1);
    });
  });

  describe('estimateCharsFromTokens', () => {
    it('should provide reasonable estimates', () => {
      expect(counter.estimateCharsFromTokens(25)).toBe(100); // 25*4
      expect(counter.estimateCharsFromTokens(0)).toBe(0);
      expect(counter.estimateCharsFromTokens(1)).toBe(4);
    });
  });

  describe('content type detection', () => {
    it('should detect code content', () => {
      const codeTexts = [
        'function test() { return true; }',
        'const x = async () => await fetch();',
        'public class Test { private int value; }',
        'if (condition) { doSomething(); }'
      ];

      codeTexts.forEach(code => {
        const tokens = counter.count(code);
        expect(tokens).toBeGreaterThan(0);
      });
    });

    it('should detect structured data', () => {
      const structuredTexts = [
        '{"key": "value", "number": 42}',
        '[1, 2, 3, 4, 5]',
        '<xml><item>content</item></xml>'
      ];

      structuredTexts.forEach(structured => {
        const tokens = counter.count(structured);
        expect(tokens).toBeGreaterThan(0);
      });
    });

    it('should handle mixed content types', () => {
      const mixedContent = `
        Here is some regular text.
        
        function example() {
          return {"result": "success"};
        }
        
        And more regular text here.
      `;

      const tokens = counter.count(mixedContent);
      expect(tokens).toBeGreaterThan(15);
    });
  });
});