import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { ContextMetadata } from '../../../../shared/types/context';
import { TokenCounter } from '../TokenCounter';

export class WebContextProvider {
  private tokenCounter: TokenCounter;
  private cache: Map<string, { content: string; metadata: ContextMetadata; timestamp: number }> = new Map();
  private cacheTimeout = 3600000; // 1 hour

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  async fetchContent(url: string): Promise<{ content: string; metadata: ContextMetadata }> {
    // Check cache
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return { content: cached.content, metadata: cached.metadata };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MultiLLM/1.0)',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const content = this.extractContent(html, url);
      const metadata: ContextMetadata = {
        mimeType: response.headers.get('content-type') || 'text/html',
        size: Buffer.byteLength(html),
        webLastCrawled: new Date(),
        tokens: this.tokenCounter.count(content),
      };

      // Cache the result
      this.cache.set(url, { content, metadata, timestamp: Date.now() });

      return { content, metadata };
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  private extractContent(html: string, url: string): string {
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, noscript').remove();

    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#content',
      '.content',
      '.documentation',
      '.markdown-body',
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainContent = element.text();
        break;
      }
    }

    // If no main content found, get body text
    if (!mainContent) {
      mainContent = $('body').text();
    }

    // Extract code blocks specially
    const codeBlocks: string[] = [];
    $('pre, code').each((_, elem) => {
      const code = $(elem).text();
      if (code.trim()) {
        codeBlocks.push(code.trim());
      }
    });

    // Extract headings for structure
    const headings: string[] = [];
    $('h1, h2, h3').each((_, elem) => {
      const heading = $(elem).text();
      if (heading.trim()) {
        headings.push(heading.trim());
      }
    });

    // Combine content
    let result = `URL: ${url}\n\n`;

    if (headings.length > 0) {
      result += 'Structure:\n';
      headings.forEach(h => result += `- ${h}\n`);
      result += '\n';
    }

    result += 'Content:\n';
    result += this.cleanText(mainContent);

    if (codeBlocks.length > 0) {
      result += '\n\nCode Examples:\n';
      codeBlocks.forEach(code => {
        result += '```\n' + code + '\n```\n\n';
      });
    }

    return result;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();
  }

  clearCache(): void {
    this.cache.clear();
  }
}