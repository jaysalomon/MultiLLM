/**
 * Context injection types
 * Requirement: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

export type ContextSourceType = 'file' | 'web' | 'git' | 'conversation' | 'database' | 'memory';

export interface ContextSource {
  id: string;
  type: ContextSourceType;
  path: string;
  lastUpdated: Date;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface ContextInjectionRequest {
  conversationId: string;
  query: string;
  maxTokens: number;
  sources: string[]; // Source IDs
}

export interface InjectedContext {
  content: string;
  sources: ContextSource[];
  tokenCount: number;
  relevanceScore: number;
  compressionApplied: boolean;
}

export interface ContextChunk {
  id: string;
  sourceId: string;
  content: string;
  metadata: ContextMetadata;
  embedding?: number[];
  relevanceScore?: number;
}

export interface ContextMetadata {
  title?: string;
  description?: string;
  lastModified?: Date;
  size?: number;
  mimeType?: string;
  language?: string;
  tags?: string[];
  [key: string]: any;
}

export interface ContextUpdate {
  sourceId: string;
  chunks: ContextChunk[];
  timestamp: Date;
  updateType: 'full' | 'partial' | 'incremental';
}

export interface ContextSearchQuery {
  query: string;
  sourceTypes?: ContextSourceType[];
  sourceIds?: string[];
  minRelevance?: number;
  maxResults?: number;
}

export interface TokenBudget {
  total: number;
  used: number;
  reserved: number;
  available: number;
}

export interface ContextScoring {
  strategy: 'keyword' | 'semantic' | 'hybrid';
  weights?: {
    keyword?: number;
    semantic?: number;
    recency?: number;
    frequency?: number;
  };
}

export interface ContextInjectionConfig {
  enabled: boolean;
  maxTokens: number;
  scoringStrategy: 'keyword' | 'semantic' | 'hybrid';
  compressionEnabled: boolean;
  autoUpdate: boolean;
  updateInterval: number;
  includeSources: ContextSourceType[];
  excludePatterns: string[];
}