import { DocumentManager, SearchResult } from './DocumentManager';
import { VectorEmbeddings } from '../memory/VectorEmbeddings';
import { DatabaseManager } from '../database/DatabaseManager';
import { EventEmitter } from 'events';

export interface KnowledgeBaseConfig {
  maxContextTokens: number;
  minSimilarityScore: number;
  maxChunksPerQuery: number;
  enableCaching: boolean;
  cacheExpirationMs: number;
}

export interface QueryResult {
  context: string;
  sources: Array<{
    documentName: string;
    documentId: string;
    chunkId: string;
    score: number;
  }>;
  metadata: {
    tokensUsed: number;
    processingTime: number;
    cached: boolean;
  };
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  avgChunkSize: number;
  languages: string[];
  fileTypes: string[];
}

export class KnowledgeBase extends EventEmitter {
  private documentManager: DocumentManager;
  private vectorEmbeddings: VectorEmbeddings;
  private config: KnowledgeBaseConfig;
  private queryCache: Map<string, { result: QueryResult; timestamp: number }>;
  private isInitialized: boolean = false;

  constructor(dbManager: DatabaseManager, config?: Partial<KnowledgeBaseConfig>) {
    super();
    this.documentManager = new DocumentManager(dbManager);
    this.vectorEmbeddings = new VectorEmbeddings();
    this.queryCache = new Map();

    this.config = {
      maxContextTokens: 4000,
      minSimilarityScore: 0.3,
      maxChunksPerQuery: 10,
      enableCaching: true,
      cacheExpirationMs: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    this.setupCacheCleanup();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.emit('initialization:start');

    try {
      await this.vectorEmbeddings.initialize();
      await this.documentManager.initialize();
      this.isInitialized = true;
      this.emit('initialization:complete');
    } catch (error) {
      this.emit('initialization:error', error);
      throw error;
    }
  }

  async addDocument(filePath: string): Promise<string> {
    this.ensureInitialized();

    this.emit('document:adding', { filePath });

    try {
      const document = await this.documentManager.addDocument(filePath);

      // Clear cache when new document is added
      this.clearCache();

      this.emit('document:added', {
        documentId: document.id,
        name: document.name,
        chunks: document.chunks.length,
      });

      return document.id;
    } catch (error) {
      this.emit('document:error', { filePath, error });
      throw error;
    }
  }

  async query(
    query: string,
    options?: {
      maxTokens?: number;
      minScore?: number;
      filterFileTypes?: string[];
      filterDocumentIds?: string[];
    }
  ): Promise<QueryResult> {
    this.ensureInitialized();

    const startTime = Date.now();

    // Check cache
    if (this.config.enableCaching) {
      const cached = this.getFromCache(query);
      if (cached) {
        return {
          ...cached.result,
          metadata: {
            ...cached.result.metadata,
            cached: true,
          },
        };
      }
    }

    this.emit('query:start', { query });

    try {
      // Search for relevant chunks
      const searchResults = await this.documentManager.searchDocuments(
        query,
        this.config.maxChunksPerQuery
      );

      // Filter by minimum similarity score
      const minScore = options?.minScore || this.config.minSimilarityScore;
      const filteredResults = searchResults.filter(r => r.score >= minScore);

      // Apply additional filters
      let finalResults = filteredResults;
      if (options?.filterFileTypes) {
        finalResults = finalResults.filter(r =>
          options.filterFileTypes!.includes(r.document.type)
        );
      }
      if (options?.filterDocumentIds) {
        finalResults = finalResults.filter(r =>
          options.filterDocumentIds!.includes(r.document.id)
        );
      }

      // Build context
      const maxTokens = options?.maxTokens || this.config.maxContextTokens;
      const { context, sources, tokensUsed } = this.buildContext(finalResults, maxTokens);

      const result: QueryResult = {
        context,
        sources,
        metadata: {
          tokensUsed,
          processingTime: Date.now() - startTime,
          cached: false,
        },
      };

      // Cache the result
      if (this.config.enableCaching) {
        this.addToCache(query, result);
      }

      this.emit('query:complete', {
        query,
        sources: sources.length,
        processingTime: result.metadata.processingTime,
      });

      return result;
    } catch (error) {
      this.emit('query:error', { query, error });
      throw error;
    }
  }

  async queryWithContext(
    query: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<QueryResult> {
    // Enhance query with conversation context
    let enhancedQuery = query;

    if (conversationHistory && conversationHistory.length > 0) {
      // Extract key topics from recent conversation
      const recentMessages = conversationHistory.slice(-5);
      const topics = this.extractTopics(recentMessages);

      if (topics.length > 0) {
        enhancedQuery = `${query} (Context: ${topics.join(', ')})`;
      }
    }

    return this.query(enhancedQuery);
  }

  async hybridSearch(
    query: string,
    keywords: string[]
  ): Promise<QueryResult> {
    this.ensureInitialized();

    // Combine semantic search with keyword search
    const semanticResults = await this.documentManager.searchDocuments(query);

    // Boost scores for chunks containing keywords
    const boostedResults = semanticResults.map(result => {
      let boost = 1.0;
      const contentLower = result.chunk.content.toLowerCase();

      for (const keyword of keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          boost += 0.1;
        }
      }

      return {
        ...result,
        score: result.score * boost,
      };
    });

    // Re-sort by boosted scores
    boostedResults.sort((a, b) => b.score - a.score);

    const maxTokens = this.config.maxContextTokens;
    const { context, sources, tokensUsed } = this.buildContext(
      boostedResults.slice(0, this.config.maxChunksPerQuery),
      maxTokens
    );

    return {
      context,
      sources,
      metadata: {
        tokensUsed,
        processingTime: 0,
        cached: false,
      },
    };
  }

  async getStats(): Promise<KnowledgeBaseStats> {
    this.ensureInitialized();

    const documents = await this.documentManager.getDocuments();

    let totalChunks = 0;
    let totalTokens = 0;
    const languages = new Set<string>();
    const fileTypes = new Set<string>();

    for (const doc of documents) {
      totalChunks += doc.chunks.length;
      for (const chunk of doc.chunks) {
        totalTokens += this.estimateTokens(chunk.content);
      }
      if (doc.metadata.language) {
        languages.add(doc.metadata.language);
      }
      fileTypes.add(doc.type);
    }

    return {
      totalDocuments: documents.length,
      totalChunks,
      totalTokens,
      avgChunkSize: totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0,
      languages: Array.from(languages),
      fileTypes: Array.from(fileTypes),
    };
  }

  async removeDocument(documentId: string): Promise<void> {
    this.ensureInitialized();

    this.emit('document:removing', { documentId });

    try {
      await this.documentManager.deleteDocument(documentId);
      this.clearCache();

      this.emit('document:removed', { documentId });
    } catch (error) {
      this.emit('document:error', { documentId, error });
      throw error;
    }
  }

  async updateDocument(documentId: string, filePath: string): Promise<void> {
    this.ensureInitialized();

    this.emit('document:updating', { documentId, filePath });

    try {
      await this.documentManager.updateDocument(documentId, filePath);
      this.clearCache();

      this.emit('document:updated', { documentId });
    } catch (error) {
      this.emit('document:error', { documentId, error });
      throw error;
    }
  }

  async exportKnowledge(format: 'json' | 'markdown' = 'json'): Promise<string> {
    this.ensureInitialized();

    const documents = await this.documentManager.getDocuments();

    if (format === 'json') {
      return JSON.stringify(documents, null, 2);
    } else {
      // Export as markdown
      let markdown = '# Knowledge Base Export\n\n';

      for (const doc of documents) {
        markdown += `## ${doc.name}\n\n`;
        markdown += `- **ID**: ${doc.id}\n`;
        markdown += `- **Type**: ${doc.type}\n`;
        markdown += `- **Size**: ${doc.size} bytes\n`;
        markdown += `- **Chunks**: ${doc.chunks.length}\n`;
        markdown += `- **Keywords**: ${doc.metadata.keywords?.join(', ') || 'N/A'}\n`;
        markdown += `- **Summary**: ${doc.metadata.summary || 'N/A'}\n\n`;

        markdown += '### Content Chunks\n\n';
        for (let i = 0; i < Math.min(3, doc.chunks.length); i++) {
          const chunk = doc.chunks[i];
          markdown += `#### Chunk ${i + 1}\n`;
          markdown += `${chunk.content.substring(0, 200)}...\n\n`;
        }

        if (doc.chunks.length > 3) {
          markdown += `_...and ${doc.chunks.length - 3} more chunks_\n\n`;
        }
      }

      return markdown;
    }
  }

  private buildContext(
    results: SearchResult[],
    maxTokens: number
  ): { context: string; sources: any[]; tokensUsed: number } {
    let context = '';
    const sources: any[] = [];
    let tokensUsed = 0;

    // Add header
    if (results.length > 0) {
      context = '## Relevant Context from Knowledge Base\n\n';
      tokensUsed += this.estimateTokens(context);
    }

    for (const result of results) {
      const chunkHeader = `### From: ${result.document.name}`;
      const chunkContent = result.chunk.content;
      const separator = '\n\n---\n\n';

      const chunkText = `${chunkHeader}\n${chunkContent}${separator}`;
      const chunkTokens = this.estimateTokens(chunkText);

      if (tokensUsed + chunkTokens > maxTokens) {
        // Try to fit partial content
        const remainingTokens = maxTokens - tokensUsed;
        if (remainingTokens > 100) {
          const partialContent = this.truncateToTokens(chunkContent, remainingTokens - 20);
          context += `${chunkHeader}\n${partialContent}...\n\n`;
          tokensUsed = maxTokens;
        }
        break;
      }

      context += chunkText;
      tokensUsed += chunkTokens;

      sources.push({
        documentName: result.document.name,
        documentId: result.document.id,
        chunkId: result.chunk.id,
        score: result.score,
      });
    }

    // Remove trailing separator
    if (context.endsWith('\n\n---\n\n')) {
      context = context.slice(0, -7);
    }

    return { context, sources, tokensUsed };
  }

  private extractTopics(messages: Array<{ role: string; content: string }>): string[] {
    const topics: string[] = [];
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an']);

    for (const msg of messages) {
      // Extract potential topics (simple noun extraction)
      const words = msg.content.split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !stopWords.has(w.toLowerCase()))
        .filter(w => /^[A-Z]/.test(w)); // Capitalized words often indicate topics

      topics.push(...words);
    }

    // Return unique topics
    return Array.from(new Set(topics)).slice(0, 5);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const estimatedChars = maxTokens * 4;
    if (text.length <= estimatedChars) {
      return text;
    }

    // Try to break at sentence boundary
    const truncated = text.substring(0, estimatedChars);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');

    const breakPoint = Math.max(lastPeriod, lastNewline);
    if (breakPoint > estimatedChars * 0.7) {
      return truncated.substring(0, breakPoint + 1);
    }

    return truncated;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('KnowledgeBase must be initialized before use');
    }
  }

  private getFromCache(query: string): { result: QueryResult; timestamp: number } | null {
    const cached = this.queryCache.get(query);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.config.cacheExpirationMs) {
        return cached;
      } else {
        this.queryCache.delete(query);
      }
    }

    return null;
  }

  private addToCache(query: string, result: QueryResult): void {
    this.queryCache.set(query, {
      result,
      timestamp: Date.now(),
    });

    // Limit cache size
    if (this.queryCache.size > 100) {
      const firstKey = this.queryCache.keys().next().value;
      if (firstKey) {
        this.queryCache.delete(firstKey);
      }
    }
  }

  private clearCache(): void {
    this.queryCache.clear();
  }

  private setupCacheCleanup(): void {
    // Periodically clean expired cache entries
    setInterval(() => {
      const now = Date.now();
      for (const [query, cached] of this.queryCache.entries()) {
        if (now - cached.timestamp > this.config.cacheExpirationMs) {
          this.queryCache.delete(query);
        }
      }
    }, 60000); // Clean every minute
  }

  async getDocuments() {
    return this.documentManager.getDocuments();
  }

  async getDocument(documentId: string) {
    return this.documentManager.getDocument(documentId);
  }
}