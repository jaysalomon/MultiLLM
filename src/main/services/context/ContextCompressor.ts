import { ContextCompressionResult } from '../../../shared/types/context';
import { TokenCounter } from './TokenCounter';

export class ContextCompressor {
  private tokenCounter: TokenCounter;

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  async compress(content: string, targetTokens: number): Promise<ContextCompressionResult> {
    const originalTokens = this.tokenCounter.count(content);

    if (originalTokens <= targetTokens) {
      return {
        original: content,
        compressed: content,
        ratio: 1,
        tokens: {
          before: originalTokens,
          after: originalTokens,
        },
        method: 'truncation',
      };
    }

    // Try different compression methods
    let result: ContextCompressionResult;

    // Method 1: Intelligent extraction (keep important sentences)
    result = await this.extractiveCompression(content, targetTokens);
    if (result.tokens.after <= targetTokens) {
      return result;
    }

    // Method 2: Summarization (for longer content)
    if (originalTokens > 500) {
      result = await this.summarizeContent(content, targetTokens);
      if (result.tokens.after <= targetTokens) {
        return result;
      }
    }

    // Method 3: Simple truncation as last resort
    return this.truncateContent(content, targetTokens);
  }

  private async extractiveCompression(
    content: string,
    targetTokens: number
  ): Promise<ContextCompressionResult> {
    const sentences = this.splitIntoSentences(content);
    const scoredSentences = this.scoreSentences(sentences);
    
    // Sort by importance score
    scoredSentences.sort((a, b) => b.score - a.score);

    let compressed = '';
    let currentTokens = 0;
    const selectedSentences: { text: string; index: number }[] = [];

    for (const sentence of scoredSentences) {
      const sentenceTokens = this.tokenCounter.count(sentence.text);
      if (currentTokens + sentenceTokens <= targetTokens) {
        selectedSentences.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Sort selected sentences by original order
    selectedSentences.sort((a, b) => a.index - b.index);
    compressed = selectedSentences.map(s => s.text).join(' ');

    return {
      original: content,
      compressed,
      ratio: compressed.length / content.length,
      tokens: {
        before: this.tokenCounter.count(content),
        after: currentTokens,
      },
      method: 'extraction',
    };
  }

  private async summarizeContent(
    content: string,
    targetTokens: number
  ): Promise<ContextCompressionResult> {
    // Simple extractive summarization
    const sentences = this.splitIntoSentences(content);
    const targetSentences = Math.ceil(sentences.length * (targetTokens / this.tokenCounter.count(content)));
    
    const scoredSentences = this.scoreSentences(sentences);
    scoredSentences.sort((a, b) => b.score - a.score);

    const topSentences = scoredSentences.slice(0, targetSentences);
    topSentences.sort((a, b) => a.index - b.index);

    const summary = topSentences.map(s => s.text).join(' ');
    const summaryTokens = this.tokenCounter.count(summary);

    return {
      original: content,
      compressed: summary,
      ratio: summary.length / content.length,
      tokens: {
        before: this.tokenCounter.count(content),
        after: summaryTokens,
      },
      method: 'summary',
    };
  }

  private truncateContent(content: string, targetTokens: number): ContextCompressionResult {
    // Estimate characters per token (rough approximation)
    const charsPerToken = 4;
    const targetChars = targetTokens * charsPerToken;
    
    let truncated = content;
    if (content.length > targetChars) {
      truncated = content.slice(0, targetChars);
      
      // Try to end at a sentence boundary
      const lastPeriod = truncated.lastIndexOf('.');
      const lastNewline = truncated.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      if (cutPoint > targetChars * 0.8) {
        truncated = truncated.slice(0, cutPoint + 1);
      }
    }

    return {
      original: content,
      compressed: truncated + (truncated.length < content.length ? '...' : ''),
      ratio: truncated.length / content.length,
      tokens: {
        before: this.tokenCounter.count(content),
        after: this.tokenCounter.count(truncated),
      },
      method: 'truncation',
    };
  }

  private splitIntoSentences(text: string): string[] {
    if (!text.trim()) return [];
    
    // Enhanced sentence splitting with better regex
    const sentenceRegex = /[.!?]+\s*(?=[A-Z]|$)/g;
    const sentences = text.split(sentenceRegex).filter(s => s.trim().length > 0);
    
    // If no sentences found, split by lines
    if (sentences.length <= 1) {
      return text.split('\n').filter(line => line.trim().length > 0);
    }
    
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  private scoreSentences(sentences: string[]): { text: string; score: number; index: number }[] {
    if (!sentences.length) return [];
    
    const wordFreq = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    // Calculate word frequencies (excluding stop words)
    sentences.forEach(sentence => {
      const words = sentence.toLowerCase().split(/\s+/);
      words.forEach(word => {
        const cleaned = word.replace(/[^a-z0-9]/g, '');
        if (cleaned.length > 2 && !stopWords.has(cleaned)) {
          wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
        }
      });
    });

    // Score sentences based on word frequencies and other factors
    return sentences.map((sentence, index) => {
      const words = sentence.toLowerCase().split(/\s+/);
      let score = 0;
      let meaningfulWords = 0;
      
      words.forEach(word => {
        const cleaned = word.replace(/[^a-z0-9]/g, '');
        if (cleaned.length > 2 && !stopWords.has(cleaned)) {
          score += wordFreq.get(cleaned) || 0;
          meaningfulWords++;
        }
      });
      
      // Normalize by meaningful word count
      score = meaningfulWords > 0 ? score / meaningfulWords : 0;
      
      // Position-based scoring (first and last sentences often important)
      if (index === 0 || index === sentences.length - 1) {
        score *= 1.3;
      }
      
      // Length-based scoring (avoid very short or very long sentences)
      const wordCount = words.length;
      if (wordCount >= 5 && wordCount <= 30) {
        score *= 1.2;
      } else if (wordCount < 3) {
        score *= 0.5;
      }
      
      // Boost score for sentences with technical keywords
      const technicalKeywords = /\b(function|class|interface|import|export|const|let|var|return|async|await|try|catch|if|else|for|while|switch|case)\b/i;
      if (technicalKeywords.test(sentence)) {
        score *= 1.4;
      }
      
      // Boost score for sentences with numbers or special characters (likely important data)
      if (/\d+/.test(sentence)) {
        score *= 1.2;
      }
      
      // Boost score for sentences with URLs or file paths
      if (/https?:\/\/|\/[a-zA-Z0-9_.-]+|[a-zA-Z]:\\/.test(sentence)) {
        score *= 1.3;
      }

      return { text: sentence, score: Math.round(score * 100) / 100, index };
    });
  }
}