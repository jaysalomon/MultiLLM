import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { watch, FSWatcher } from 'chokidar';
import {
  ContextSource,
  ContextSourceType,
  ContextChunk,
  ContextMetadata,
  ContextInjectionConfig,
  ContextUpdate,
  ContextSearchQuery,
  TokenBudget,
  ContextScoring,
} from '../../../shared/types/context';
import { DatabaseManager } from '../../../database/DatabaseManager';
import { ContextScorer } from './ContextScorer';
import { ContextCompressor } from './ContextCompressor';
import { TokenCounter } from './TokenCounter';
import { GitContextProvider } from './providers/GitContextProvider';
import { WebContextProvider } from './providers/WebContextProvider';
import { FileContextProvider } from './providers/FileContextProvider';

export class ContextManager extends EventEmitter {
  private sources: Map<string, ContextSource> = new Map();
  private chunks: Map<string, ContextChunk[]> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  private config: ContextInjectionConfig;
  private scorer: ContextScorer;
  private compressor: ContextCompressor;
  private tokenCounter: TokenCounter;
  private gitProvider: GitContextProvider;
  private webProvider: WebContextProvider;
  private fileProvider: FileContextProvider;
  private updateTimer?: NodeJS.Timeout;

  constructor(
    private dbManager: DatabaseManager,
    config?: Partial<ContextInjectionConfig>
  ) {
    super();
    this.config = {
      enabled: true,
      maxTokens: 8000,
      scoringStrategy: 'hybrid',
      compressionEnabled: true,
      autoUpdate: true,
      updateInterval: 30000, // 30 seconds
      includeSources: ['file', 'web', 'git', 'conversation', 'memory'],
      excludePatterns: ['node_modules/**', '*.log', '.git/**'],
      ...config,
    };

    this.scorer = new ContextScorer();
    this.compressor = new ContextCompressor();
    this.tokenCounter = new TokenCounter();
    this.gitProvider = new GitContextProvider();
    this.webProvider = new WebContextProvider();
    this.fileProvider = new FileContextProvider();

    if (this.config.autoUpdate) {
      this.startAutoUpdate();
    }
  }

  async addSource(source: Omit<ContextSource, 'id' | 'lastUpdated'>): Promise<ContextSource> {
    const id = this.generateSourceId(source);
    const newSource: ContextSource = {
      ...source,
      id,
      lastUpdated: new Date(),
    };

    this.sources.set(id, newSource);

    // Process the source based on type
    await this.processSource(newSource);

    // Set up file watcher if needed
    if (source.type === 'file' && source.path && this.config.autoUpdate) {
      await this.watchFile(id, source.path);
    }

    this.emit('source:added', newSource);
    return newSource;
  }

  async removeSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) return;

    // Stop watching if applicable
    const watcher = this.watchers.get(sourceId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(sourceId);
    }

    this.sources.delete(sourceId);
    this.chunks.delete(sourceId);
    this.emit('source:removed', source);
  }

  async updateSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (!source) return;

    await this.processSource(source);
    source.lastUpdated = new Date();
    this.emit('source:updated', source);
  }

  private async processSource(source: ContextSource): Promise<void> {
    let content: string | undefined;
    let metadata: Partial<ContextMetadata> = {};

    switch (source.type) {
      case 'file':
        if (source.path) {
          const result = await this.fileProvider.loadFile(source.path);
          content = result.content;
          metadata = result.metadata;
        }
        break;

      case 'web':
        if (source.url) {
          const result = await this.webProvider.fetchContent(source.url);
          content = result.content;
          metadata = result.metadata;
        }
        break;

      case 'git':
        if (source.path) {
          const result = await this.gitProvider.getRepoContext(source.path);
          content = result.content;
          metadata = result.metadata;
        }
        break;

      case 'conversation':
        if (source.conversationId) {
          const conversation = await this.dbManager.conversations.getConversation(source.conversationId);
          if (conversation) {
            content = JSON.stringify(conversation.messages);
            metadata.tokens = this.tokenCounter.count(content);
          }
        }
        break;

      case 'memory':
        // Memory is handled by the SharedMemoryService
        content = source.content;
        break;
    }

    if (content) {
      source.content = content;
      source.metadata = { ...source.metadata, ...metadata };

      // Generate chunks
      const chunks = await this.generateChunks(source.id, content, source.metadata);
      this.chunks.set(source.id, chunks);
    }
  }

  private async generateChunks(
    sourceId: string,
    content: string,
    metadata: ContextMetadata
  ): Promise<ContextChunk[]> {
    const chunks: ContextChunk[] = [];
    const chunkSize = 1000; // Characters per chunk
    const overlap = 100; // Character overlap between chunks

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunkContent = content.slice(i, i + chunkSize);
      const tokens = this.tokenCounter.count(chunkContent);

      chunks.push({
        id: `${sourceId}-${i}`,
        sourceId,
        content: chunkContent,
        score: 0,
        tokens,
        startLine: this.getLineNumber(content, i),
        endLine: this.getLineNumber(content, Math.min(i + chunkSize, content.length)),
      });
    }

    return chunks;
  }

  async search(query: ContextSearchQuery): Promise<ContextChunk[]> {
    const allChunks: ContextChunk[] = [];

    // Collect chunks from specified sources
    for (const [sourceId, sourceChunks] of this.chunks.entries()) {
      const source = this.sources.get(sourceId);
      if (!source || !source.isActive) continue;

      if (query.sources && !query.sources.includes(sourceId)) continue;
      if (query.types && !query.types.includes(source.type)) continue;

      allChunks.push(...sourceChunks);
    }

    // Score chunks
    const scoredChunks = await this.scorer.scoreChunks(allChunks, query.query);

    // Filter by minimum score
    const filtered = query.minScore
      ? scoredChunks.filter(c => c.score >= (query.minScore || 0))
      : scoredChunks;

    // Sort by score and limit
    const sorted = filtered.sort((a, b) => b.score - a.score);
    return query.limit ? sorted.slice(0, query.limit) : sorted;
  }

  async getContextForPrompt(
    query: string,
    maxTokens?: number
  ): Promise<{ context: string; chunks: ContextChunk[]; budget: TokenBudget }> {
    const tokenBudget: TokenBudget = {
      total: maxTokens || this.config.maxTokens,
      used: 0,
      reserved: 500, // Reserve tokens for system prompt
      available: (maxTokens || this.config.maxTokens) - 500,
      allocation: new Map(),
    };

    // Search for relevant chunks
    const chunks = await this.search({
      query,
      limit: 50, // Get more chunks than needed for selection
    });

    // Allocate tokens to chunks based on scores
    const selectedChunks: ContextChunk[] = [];
    let remainingTokens = tokenBudget.available;

    for (const chunk of chunks) {
      if (chunk.tokens <= remainingTokens) {
        selectedChunks.push(chunk);
        remainingTokens -= chunk.tokens;
        tokenBudget.allocation.set(chunk.sourceId, 
          (tokenBudget.allocation.get(chunk.sourceId) || 0) + chunk.tokens
        );
      } else if (this.config.compressionEnabled && chunk.tokens > 100) {
        // Try to compress the chunk
        const compressed = await this.compressor.compress(chunk.content, remainingTokens);
        if (compressed.tokens.after <= remainingTokens) {
          selectedChunks.push({
            ...chunk,
            content: compressed.compressed,
            tokens: compressed.tokens.after,
          });
          remainingTokens -= compressed.tokens.after;
          tokenBudget.allocation.set(chunk.sourceId,
            (tokenBudget.allocation.get(chunk.sourceId) || 0) + compressed.tokens.after
          );
        }
      }

      if (remainingTokens < 50) break; // Stop if we're running out of tokens
    }

    tokenBudget.used = tokenBudget.available - remainingTokens;

    // Format context for prompt
    const context = this.formatContext(selectedChunks);

    return { context, chunks: selectedChunks, budget: tokenBudget };
  }

  private formatContext(chunks: ContextChunk[]): string {
    const groupedBySource = new Map<string, ContextChunk[]>();

    for (const chunk of chunks) {
      if (!groupedBySource.has(chunk.sourceId)) {
        groupedBySource.set(chunk.sourceId, []);
      }
      groupedBySource.get(chunk.sourceId)!.push(chunk);
    }

    let context = '';
    for (const [sourceId, sourceChunks] of groupedBySource) {
      const source = this.sources.get(sourceId);
      if (!source) continue;

      context += `\n## Context from ${source.name} (${source.type})\n\n`;
      for (const chunk of sourceChunks) {
        if (chunk.startLine && chunk.endLine) {
          context += `Lines ${chunk.startLine}-${chunk.endLine}:\n`;
        }
        context += chunk.content + '\n\n';
      }
    }

    return context.trim();
  }

  private async watchFile(sourceId: string, filePath: string): Promise<void> {
    const watcher = watch(filePath, {
      persistent: false,
      ignoreInitial: true,
    });

    watcher.on('change', async () => {
      await this.updateSource(sourceId);
      this.emit('context:update', {
        sourceId,
        type: 'update',
        timestamp: new Date(),
      } as ContextUpdate);
    });

    this.watchers.set(sourceId, watcher);
  }

  private startAutoUpdate(): void {
    this.updateTimer = setInterval(async () => {
      for (const source of this.sources.values()) {
        if (source.type === 'web' && source.isActive) {
          await this.updateSource(source.id);
        }
      }
    }, this.config.updateInterval);
  }

  private generateSourceId(source: Omit<ContextSource, 'id' | 'lastUpdated'>): string {
    const hash = crypto.createHash('sha256');
    hash.update(source.type);
    hash.update(source.name);
    hash.update(source.path || source.url || source.conversationId || '');
    return hash.digest('hex').slice(0, 16);
  }

  private getLineNumber(content: string, position: number): number {
    return content.slice(0, position).split('\n').length;
  }

  async cleanup(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }

    this.watchers.clear();
    this.sources.clear();
    this.chunks.clear();
  }
}