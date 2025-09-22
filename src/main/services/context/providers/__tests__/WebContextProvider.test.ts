import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fetch from 'node-fetch';
import { WebContextProvider } from '../WebContextProvider';

// Mock node-fetch
vi.mock('node-fetch');
const mockFetch = vi.mocked(fetch);

// Mock cheerio
vi.mock('cheerio', () => ({
  load: vi.fn((html: string) => {
    // Simple mock cheerio implementation
    const mockCheerio = {
      $: vi.fn(),
      remove: vi.fn().mockReturnThis(),
      length: 1,
      text: vi.fn(),
      each: vi.fn()
    };

    // Mock jQuery-like object
    const mockElement = {
      remove: vi.fn().mockReturnThis(),
      length: 1,
      text: vi.fn(),
      each: vi.fn()
    };

    const $ = vi.fn((selector: string) => {
      if (selector === 'script, style, noscript') {
        return mockElement;
      }
      if (selector === 'main') {
        mockElement.text.mockReturnValue('Main content from main tag');
        return mockElement;
      }
      if (selector === 'body') {
        mockElement.text.mockReturnValue('Full body content');
        return mockElement;
      }
      if (selector === 'pre, code') {
        mockElement.each.mockImplementation((callback) => {
          const codeElement = { text: () => 'console.log("hello");' };
          callback(0, codeElement);
        });
        return mockElement;
      }
      if (selector === 'h1, h2, h3') {
        mockElement.each.mockImplementation((callback) => {
          const headingElement = { text: () => 'Sample Heading' };
          callback(0, headingElement);
        });
        return mockElement;
      }
      return mockElement;
    });

    return $;
  })
}));

describe('WebContextProvider', () => {
  let provider: WebContextProvider;

  beforeEach(() => {
    vi.useRealTimers();
    provider = new WebContextProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchContent', () => {
    it('should successfully fetch and parse HTML content', async () => {
      const url = 'https://example.com/docs';
      const htmlContent = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <main>
              <h1>Documentation</h1>
              <p>This is the main content.</p>
              <pre><code>console.log("example");</code></pre>
            </main>
          </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(htmlContent),
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'content-type') return 'text/html';
            return null;
          })
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.fetchContent(url);

      expect(result.content).toContain(`URL: ${url}`);
      expect(result.content).toContain('Structure:');
      expect(result.content).toContain('Main content from main tag');
      expect(result.content).toContain('Content:');
      expect(result.content).toContain('Code Examples:');
      expect(result.metadata.mimeType).toBe('text/html');
      expect(result.metadata.webLastCrawled).toBeInstanceOf(Date);
      expect(result.metadata.tokens).toBeGreaterThan(0);
    });

    it('should handle HTTP errors', async () => {
      const url = 'https://example.com/notfound';
      
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn()
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(provider.fetchContent(url)).rejects.toThrow('HTTP error! status: 404');
    });

    it('should handle network timeouts', async () => {
      const url = 'https://example.com/slow';
      
      mockFetch.mockRejectedValue(new Error('AbortError'));

      await expect(provider.fetchContent(url)).rejects.toThrow('AbortError');
    }, 1000);

    it('should use cache for repeated requests', async () => {
      const url = 'https://example.com/cached';
      const htmlContent = '<html><body><main>Cached content</main></body></html>';

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(htmlContent),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      // First request
      const result1 = await provider.fetchContent(url);
      
      // Second request (should use cache)
      const result2 = await provider.fetchContent(url);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.content).toBe(result2.content);
    });

    it('should refresh cache after timeout', async () => {
      vi.useFakeTimers();
      
      const url = 'https://example.com/refresh';
      const htmlContent = '<html><body><main>Fresh content</main></body></html>';

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(htmlContent),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      // First request
      await provider.fetchContent(url);
      
      // Advance time beyond cache timeout (1 hour)
      vi.advanceTimersByTime(3600001);
      
      // Second request (should fetch again)
      await provider.fetchContent(url);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should handle fetch errors gracefully', async () => {
      const url = 'https://example.com/error';
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(provider.fetchContent(url)).rejects.toThrow('Network error');
    });

    it('should extract content from different selectors', async () => {
      const url = 'https://example.com/article';
      const htmlContent = `
        <html>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>Article content here.</p>
            </article>
          </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(htmlContent),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      // Mock cheerio to return article content
      const cheerio = await import('cheerio');
      const mockLoad = vi.mocked(cheerio.load);
      mockLoad.mockReturnValue((() => {
        const mockElement = {
          remove: vi.fn().mockReturnThis(),
          length: 1,
          text: vi.fn().mockReturnValue('Article content from article tag'),
          each: vi.fn()
        };

        return vi.fn((selector: string) => {
          if (selector === 'article') {
            return mockElement;
          }
          if (selector === 'script, style, noscript') {
            return mockElement;
          }
          return { ...mockElement, length: 0 };
        });
      })() as any);

      const result = await provider.fetchContent(url);

      expect(result.content).toContain('Article content from article tag');
    });

    it('should clean text content properly', async () => {
      const url = 'https://example.com/messy';
      const htmlContent = `
        <html>
          <body>
            <main>
              <p>Text   with    multiple     spaces</p>
              <p>Line 1</p>
              
              
              
              <p>Line 2 after many newlines</p>
            </main>
          </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(htmlContent),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      // Mock cheerio to return messy content
      const cheerio = await import('cheerio');
      const mockLoad = vi.mocked(cheerio.load);
      mockLoad.mockReturnValue((() => {
        const mockElement = {
          remove: vi.fn().mockReturnThis(),
          length: 1,
          text: vi.fn().mockReturnValue('Text   with    multiple     spaces\n\n\n\nLine 2 after many newlines'),
          each: vi.fn()
        };

        return vi.fn((selector: string) => {
          if (selector === 'main') {
            return mockElement;
          }
          if (selector === 'script, style, noscript') {
            return mockElement;
          }
          return { ...mockElement, length: 0 };
        });
      })() as any);

      const result = await provider.fetchContent(url);

      // Content should be cleaned (single spaces, max double newlines)
      expect(result.content).not.toContain('   ');
      expect(result.content).not.toContain('\n\n\n');
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      const url = 'https://example.com/cache-test';
      const htmlContent = '<html><body><main>Test content</main></body></html>';

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(htmlContent),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      // First request
      await provider.fetchContent(url);
      
      // Clear cache
      provider.clearCache();
      
      // Second request (should fetch again)
      await provider.fetchContent(url);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error scenarios', () => {
    it('should handle malformed HTML gracefully', async () => {
      const url = 'https://example.com/malformed';
      const malformedHtml = '<html><body><main>Unclosed tag<p>Content</main></body>';

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(malformedHtml),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.fetchContent(url);

      expect(result.content).toContain(`URL: ${url}`);
      expect(result.metadata.mimeType).toBe('text/html');
    });

    it('should handle empty response', async () => {
      const url = 'https://example.com/empty';

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
        headers: {
          get: vi.fn(() => 'text/html')
        }
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.fetchContent(url);

      expect(result.content).toContain(`URL: ${url}`);
      expect(result.metadata.tokens).toBeGreaterThan(0); // Should at least have URL tokens
    });
  });
});