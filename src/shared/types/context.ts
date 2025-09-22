// Context injection system types

export type ContextSourceType = 'file' | 'web' | 'git' | 'conversation' | 'memory';

export interface ContextSource {
  id: string;
  type: ContextSourceType;
  name: string;
  path?: string; // For file/git sources
  url?: string; // For web sources
  conversationId?: string; // For conversation sources
  content?: string;
  metadata: ContextMetadata;
  lastUpdated: Date;
  isActive: boolean;
  priority: number; // 0-100, higher = more important
}

export interface ContextMetadata {
  mimeType?: string;
  language?: string; // Programming language for code files
  encoding?: string;
  size?: number;
  hash?: string; // Content hash for change detection
  gitBranch?: string;
  gitCommit?: string;
  webLastCrawled?: Date;
  tokens?: number;
  summary?: string;
}

export interface ContextChunk {
  id: string;
  sourceId: string;
  content: string;
  embedding?: number[];
  score: number; // Relevance score
  startLine?: number;
  endLine?: number;
  tokens: number;
}

export interface TokenBudget {
  total: number;
  used: number;
  reserved: number; // For system prompts
  available: number;
  allocation: Map<string, number>; // sourceId -> allocated tokens
}

export interface ContextInjectionConfig {
  enabled: boolean;
  maxTokens: number;
  scoringStrategy: 'similarity' | 'recency' | 'hybrid';
  compressionEnabled: boolean;
  autoUpdate: boolean;
  updateInterval: number; // ms
  includeSources: ContextSourceType[];
  excludePatterns: string[];
}

export interface ContextScoring {
  relevanceScore: number; // Semantic similarity
  recencyScore: number; // Time-based decay
  priorityScore: number; // User-defined priority
  frequencyScore: number; // How often referenced
  combinedScore: number;
}

export interface ContextUpdate {
  sourceId: string;
  type: 'add' | 'update' | 'remove';
  changes?: {
    added?: string[];
    removed?: string[];
    modified?: string[];
  };
  timestamp: Date;
}

export interface ContextSearchQuery {
  query: string;
  sources?: string[]; // Source IDs to search
  types?: ContextSourceType[];
  limit?: number;
  minScore?: number;
}

export interface ContextCompressionResult {
  original: string;
  compressed: string;
  ratio: number;
  tokens: {
    before: number;
    after: number;
  };
  method: 'summary' | 'extraction' | 'truncation';
}