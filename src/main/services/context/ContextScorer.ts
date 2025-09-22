import { ContextChunk, ContextScoring } from '../../../shared/types/context';
import * as natural from 'natural';

export class ContextScorer {
  private tfidf: any;
  private tokenizer: any;
  private stemmer: any;
  private stopWords: Set<string>;

  constructor() {
    this.tfidf = new natural.TfIdf();
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
  }

  async scoreChunks(chunks: ContextChunk[], query: string): Promise<ContextChunk[]> {
    if (!chunks.length || !query.trim()) {
      return chunks;
    }

    // Reset TF-IDF for fresh scoring
    this.tfidf = new natural.TfIdf();

    // Preprocess query
    const processedQuery = (this as any).preprocessText(query);
    this.tfidf.addDocument(processedQuery);
    const queryIndex = 0;

    // Add all chunks to TF-IDF with preprocessing
    const chunkIndices: Map<number, ContextChunk> = new Map();
    chunks.forEach((chunk, index) => {
      const processedContent = (this as any).preprocessText(chunk.content);
      this.tfidf.addDocument(processedContent);
      chunkIndices.set(index + 1, chunk); // +1 because query is at index 0
    });

    // Score each chunk
    const scoredChunks: ContextChunk[] = [];

    for (const [index, chunk] of chunkIndices.entries()) {
      const scoring = this.calculateScoring(chunk, query, index);
      
      scoredChunks.push({
        ...chunk,
        score: Math.round(scoring.combinedScore * 100) / 100, // Round to 2 decimal places
      });
    }

    // Sort by score descending
    return scoredChunks.sort((a, b) => b.score - a.score);
  }

  private calculateScoring(chunk: ContextChunk, query: string, docIndex: number): ContextScoring {
    // Calculate relevance score using TF-IDF
    const relevanceScore = this.calculateRelevance(query, docIndex);

    // Calculate recency score (newer content scores higher)
    const recencyScore = this.calculateRecency(chunk);

    // Priority score from the chunk's source
    const priorityScore = chunk.score || 50; // Default to 50 if not set

    // Frequency score (placeholder - would track usage)
    const frequencyScore = 50; // Default

    // Combine scores with weights
    const weights = {
      relevance: 0.4,
      recency: 0.2,
      priority: 0.2,
      frequency: 0.2,
    };

    const combinedScore = 
      relevanceScore * weights.relevance +
      recencyScore * weights.recency +
      priorityScore * weights.priority +
      frequencyScore * weights.frequency;

    return {
      relevanceScore,
      recencyScore,
      priorityScore,
      frequencyScore,
      combinedScore,
    };
  }

  private calculateRelevance(query: string, docIndex: number): number {
    const processedQuery = this.preprocessText(query);
    const queryTokens = this.tokenizer.tokenize(processedQuery);
    
    if (!queryTokens.length) return 0;

    let totalScore = 0;
    let termCount = 0;

    queryTokens.forEach((term: string) => {
      if (!this.stopWords.has(term.toLowerCase())) {
        const score = this.tfidf.tfidf(term, docIndex);
        totalScore += score;
        termCount++;
      }
    });

    if (termCount === 0) return 0;

    // Average TF-IDF score, normalized to 0-100
    const avgScore = totalScore / termCount;
    return Math.min(100, Math.max(0, avgScore * 25));
  }

  private calculateRecency(chunk: ContextChunk): number {
    // Default recency score - in production would use actual timestamps
    // Could be enhanced to use source metadata
    return 75;
  }

  private preprocessText(text: string): string {
    if (!text) return '';
    
    // Convert to lowercase and tokenize
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    
    // Remove stop words and stem
    const processedTokens = tokens
      .filter((token: string) => !this.stopWords.has(token))
      .map((token: string) => this.stemmer.stem(token))
      .filter((token: string) => token.length > 2); // Remove very short tokens
    
    return processedTokens.join(' ');
  }

  calculateSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenizer.tokenize(text1.toLowerCase()));
    const tokens2 = new Set(this.tokenizer.tokenize(text2.toLowerCase()));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) return 0;
    return (intersection.size / union.size) * 100;
  }
}