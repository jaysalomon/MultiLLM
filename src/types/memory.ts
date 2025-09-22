/**
 * Shared Memory System interfaces
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

/**
 * Shared memory context accessible to all LLMs
 * Requirements: 8.1, 8.2
 */
export interface SharedMemoryContext {
  conversationId: string;
  facts: MemoryFact[];
  summaries: ConversationSummary[];
  relationships: EntityRelationship[];
  lastUpdated: Date;
  version: number; // for conflict resolution
}

/**
 * Individual memory fact stored in shared memory
 * Requirements: 8.1, 8.2
 */
export interface MemoryFact {
  id: string;
  content: string;
  source: string; // model ID or 'user' who contributed this fact
  timestamp: Date;
  relevanceScore: number; // 0-1 score for relevance to current conversation
  tags: string[];
  embedding?: number[]; // vector embedding for semantic search
  verified: boolean; // whether this fact has been confirmed by multiple sources
  references: string[]; // message IDs that support this fact
}

/**
 * Conversation summary for long discussions
 * Requirements: 8.3, 8.5
 */
export interface ConversationSummary {
  id: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: string;
  keyPoints: string[];
  participants: string[]; // model IDs and 'user'
  messageCount: number;
  embedding?: number[]; // vector embedding for semantic search
  createdBy: string; // which model or system created this summary
  createdAt: Date;
}

/**
 * Relationships between entities mentioned in conversation
 * Requirements: 8.1, 8.4
 */
export interface EntityRelationship {
  id: string;
  sourceEntity: string;
  targetEntity: string;
  relationshipType: string; // e.g., 'is_a', 'part_of', 'related_to'
  confidence: number; // 0-1 confidence score
  evidence: string[]; // message IDs that support this relationship
  createdBy: string; // model ID that identified this relationship
  createdAt: Date;
}

/**
 * Memory search query
 * Requirements: 8.2, 8.5
 */
export interface MemorySearchQuery {
  query: string;
  type?: 'facts' | 'summaries' | 'relationships' | 'all';
  limit?: number;
  minRelevanceScore?: number;
  timeRange?: {
    start?: Date;
    end?: Date;
  };
  tags?: string[];
  sources?: string[]; // filter by specific model IDs or 'user'
}

/**
 * Memory search result
 * Requirements: 8.2, 8.5
 */
export interface MemorySearchResult {
  facts: MemoryFact[];
  summaries: ConversationSummary[];
  relationships: EntityRelationship[];
  totalResults: number;
  searchTime: number; // in milliseconds
}

/**
 * Memory update notification
 * Requirements: 8.4
 */
export interface MemoryUpdateNotification {
  type: 'fact_added' | 'summary_created' | 'relationship_discovered';
  conversationId: string;
  data: MemoryFact | ConversationSummary | EntityRelationship;
  timestamp: Date;
  source: string; // model ID that triggered the update
}

/**
 * Memory extraction request
 * Requirements: 8.1, 8.4
 */
export interface MemoryExtractionRequest {
  conversationId: string;
  messages: Array<{
    id: string;
    content: string;
    sender: string;
    timestamp: Date;
  }>;
  extractionType: 'facts' | 'relationships' | 'summary' | 'all';
  context?: SharedMemoryContext; // existing memory for context
}

/**
 * Memory extraction result
 * Requirements: 8.1, 8.4
 */
export interface MemoryExtractionResult {
  facts: Omit<MemoryFact, 'id' | 'embedding'>[];
  relationships: Omit<EntityRelationship, 'id'>[];
  summary?: Omit<ConversationSummary, 'id' | 'embedding'>;
  confidence: number; // overall confidence in extraction quality
  processingTime: number; // in milliseconds
}