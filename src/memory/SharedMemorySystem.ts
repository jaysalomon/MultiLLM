import { VectorEmbeddings } from './VectorEmbeddings';
import { MemoryExtractor } from './MemoryExtractor';
import { MemoryRepository } from '../database/MemoryRepository';
import type { 
  SharedMemoryContext,
  MemoryFact,
  ConversationSummary,
  EntityRelationship,
  MemorySearchQuery,
  MemorySearchResult,
  MemoryUpdateNotification,
  MemoryExtractionRequest
} from '../types/memory';
import type { ChatMessage } from '../types/chat';
import { EventEmitter } from 'events';

/**
 * Shared memory system with local vector embeddings
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export class SharedMemorySystem extends EventEmitter {
  private vectorEmbeddings: VectorEmbeddings;
  private memoryExtractor: MemoryExtractor;
  private memoryRepository: MemoryRepository;
  private isInitialized = false;

  constructor(memoryRepository: MemoryRepository) {
    super();
    this.memoryRepository = memoryRepository;
    this.vectorEmbeddings = new VectorEmbeddings();
    this.memoryExtractor = new MemoryExtractor();
  }

  /**
   * Initialize the shared memory system
   * Requirements: 8.1, 8.2
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing shared memory system...');
      await this.vectorEmbeddings.initialize();
      this.isInitialized = true;
      console.log('Shared memory system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize shared memory system:', error);
      throw error;
    }
  }

  /**
   * Get shared memory context for a conversation
   * Requirements: 8.1, 8.2
   */
  async getSharedMemory(conversationId: string): Promise<SharedMemoryContext> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.memoryRepository.getSharedMemory(conversationId);
  }

  /**
   * Add a memory fact with vector embedding
   * Requirements: 8.1, 8.2
   */
  async addFact(
    conversationId: string, 
    fact: Omit<MemoryFact, 'id' | 'embedding'>
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate embedding for the fact content
      const embedding = await this.vectorEmbeddings.generateEmbedding(fact.content);
      
      // Add fact with embedding to repository
      const factId = await this.memoryRepository.addFact(conversationId, {
        ...fact,
        embedding
      });

      // Emit update notification
      this.emit('memoryUpdated', {
        type: 'fact_added',
        conversationId,
        data: { ...fact, id: factId, embedding },
        timestamp: new Date(),
        source: fact.source
      } as MemoryUpdateNotification);

      return factId;
    } catch (error) {
      console.error('Failed to add memory fact:', error);
      throw error;
    }
  }

  /**
   * Add a conversation summary with vector embedding
   * Requirements: 8.3, 8.5
   */
  async addSummary(
    conversationId: string,
    summary: Omit<ConversationSummary, 'id' | 'embedding'>
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate embedding for the summary content
      const embedding = await this.vectorEmbeddings.generateEmbedding(
        `${summary.summary} ${summary.keyPoints.join(' ')}`
      );

      // Add summary with embedding to repository
      const summaryId = await this.memoryRepository.addSummary(conversationId, {
        ...summary,
        embedding
      });

      // Emit update notification
      this.emit('memoryUpdated', {
        type: 'summary_created',
        conversationId,
        data: { ...summary, id: summaryId, embedding },
        timestamp: new Date(),
        source: summary.createdBy
      } as MemoryUpdateNotification);

      return summaryId;
    } catch (error) {
      console.error('Failed to add conversation summary:', error);
      throw error;
    }
  }

  /**
   * Add an entity relationship
   * Requirements: 8.1, 8.4
   */
  async addRelationship(
    conversationId: string,
    relationship: Omit<EntityRelationship, 'id'>
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const relationshipId = await this.memoryRepository.addRelationship(conversationId, relationship);

      // Emit update notification
      this.emit('memoryUpdated', {
        type: 'relationship_discovered',
        conversationId,
        data: { ...relationship, id: relationshipId },
        timestamp: new Date(),
        source: relationship.createdBy
      } as MemoryUpdateNotification);

      return relationshipId;
    } catch (error) {
      console.error('Failed to add entity relationship:', error);
      throw error;
    }
  }

  /**
   * Semantic search using vector embeddings
   * Requirements: 8.2, 8.5
   */
  async semanticSearch(
    conversationId: string,
    query: string,
    options: {
      type?: 'facts' | 'summaries' | 'all';
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<MemorySearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const { type = 'all', limit = 10, minSimilarity = 0.3 } = options;

    try {
      // Generate query embedding
      const queryEmbedding = await this.vectorEmbeddings.generateEmbedding(query);

      // Get memory context
      const memoryContext = await this.getSharedMemory(conversationId);

      const result: MemorySearchResult = {
        facts: [],
        summaries: [],
        relationships: [],
        totalResults: 0,
        searchTime: 0
      };

      // Search facts using vector similarity
      if (type === 'facts' || type === 'all') {
        const factCandidates = memoryContext.facts
          .filter(fact => fact.embedding && fact.embedding.length > 0)
          .map(fact => ({
            vector: fact.embedding!,
            id: fact.id,
            metadata: fact
          }));

        const similarFacts = this.vectorEmbeddings.findSimilar(
          queryEmbedding,
          factCandidates,
          limit,
          minSimilarity
        );

        result.facts = similarFacts.map(match => match.metadata);
      }

      // Search summaries using vector similarity
      if (type === 'summaries' || type === 'all') {
        const summaryCandidates = memoryContext.summaries
          .filter(summary => summary.embedding && summary.embedding.length > 0)
          .map(summary => ({
            vector: summary.embedding!,
            id: summary.id,
            metadata: summary
          }));

        const similarSummaries = this.vectorEmbeddings.findSimilar(
          queryEmbedding,
          summaryCandidates,
          limit,
          minSimilarity
        );

        result.summaries = similarSummaries.map(match => match.metadata);
      }

      // For relationships, use text-based search as they don't have embeddings
      if (type === 'all') {
        result.relationships = memoryContext.relationships
          .filter(rel => 
            rel.sourceEntity.toLowerCase().includes(query.toLowerCase()) ||
            rel.targetEntity.toLowerCase().includes(query.toLowerCase()) ||
            rel.relationshipType.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, limit);
      }

      result.totalResults = result.facts.length + result.summaries.length + result.relationships.length;
      result.searchTime = Date.now() - startTime;

      return result;
    } catch (error) {
      console.error('Semantic search failed:', error);
      return {
        facts: [],
        summaries: [],
        relationships: [],
        totalResults: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Extract and store memory from conversation messages
   * Requirements: 8.1, 8.4
   */
  async extractAndStoreMemory(
    conversationId: string,
    messages: ChatMessage[],
    extractionType: 'facts' | 'relationships' | 'summary' | 'all' = 'all'
  ): Promise<{
    factsAdded: number;
    relationshipsAdded: number;
    summaryAdded: boolean;
    processingTime: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let factsAdded = 0;
    let relationshipsAdded = 0;
    let summaryAdded = false;

    try {
      // Get existing memory context for better extraction
      const existingMemory = await this.getSharedMemory(conversationId);

      // Prepare extraction request
      const extractionRequest: MemoryExtractionRequest = {
        conversationId,
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp
        })),
        extractionType,
        context: existingMemory
      };

      // Extract memory
      const extractionResult = await this.memoryExtractor.extractMemory(extractionRequest);

      // Store extracted facts
      if (extractionResult.facts.length > 0) {
        for (const fact of extractionResult.facts) {
          await this.addFact(conversationId, fact);
          factsAdded++;
        }
      }

      // Store extracted relationships
      if (extractionResult.relationships.length > 0) {
        for (const relationship of extractionResult.relationships) {
          await this.addRelationship(conversationId, relationship);
          relationshipsAdded++;
        }
      }

      // Store summary if generated
      if (extractionResult.summary) {
        await this.addSummary(conversationId, extractionResult.summary);
        summaryAdded = true;
      }

      return {
        factsAdded,
        relationshipsAdded,
        summaryAdded,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Memory extraction and storage failed:', error);
      return {
        factsAdded,
        relationshipsAdded,
        summaryAdded,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Update relevance scores based on conversation context
   * Requirements: 8.2, 8.5
   */
  async updateRelevanceScores(
    conversationId: string,
    currentContext: string
  ): Promise<{ updatedFacts: number; processingTime: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let updatedFacts = 0;

    try {
      // Generate embedding for current context
      const contextEmbedding = await this.vectorEmbeddings.generateEmbedding(currentContext);

      // Get all facts for the conversation
      const facts = await this.memoryRepository.getFacts(conversationId);

      // Update relevance scores based on similarity to current context
      for (const fact of facts) {
        if (fact.embedding && fact.embedding.length > 0) {
          const similarity = this.vectorEmbeddings.calculateSimilarity(
            contextEmbedding,
            fact.embedding
          );

          // Update relevance score (weighted combination of original score and similarity)
          const newRelevanceScore = (fact.relevanceScore * 0.7) + (similarity * 0.3);

          if (Math.abs(newRelevanceScore - fact.relevanceScore) > 0.05) {
            await this.memoryRepository.updateFact(fact.id, {
              relevanceScore: newRelevanceScore
            });
            updatedFacts++;
          }
        }
      }

      return {
        updatedFacts,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Failed to update relevance scores:', error);
      return {
        updatedFacts: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get relevant memory for LLM context injection
   * Requirements: 8.2, 8.4, 8.5
   */
  async getRelevantMemory(
    conversationId: string,
    query: string,
    maxTokens: number = 1000
  ): Promise<{
    facts: MemoryFact[];
    summaries: ConversationSummary[];
    relationships: EntityRelationship[];
    tokenCount: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Perform semantic search
      const searchResult = await this.semanticSearch(conversationId, query, {
        type: 'all',
        limit: 20,
        minSimilarity: 0.2
      });

      // Estimate token counts and select most relevant items within budget
      const result = {
        facts: [] as MemoryFact[],
        summaries: [] as ConversationSummary[],
        relationships: [] as EntityRelationship[],
        tokenCount: 0
      };

      // Prioritize facts (most specific information)
      for (const fact of searchResult.facts) {
        const estimatedTokens = this.estimateTokenCount(fact.content);
        if (result.tokenCount + estimatedTokens <= maxTokens * 0.6) { // Reserve 60% for facts
          result.facts.push(fact);
          result.tokenCount += estimatedTokens;
        }
      }

      // Add summaries (broader context)
      for (const summary of searchResult.summaries) {
        const estimatedTokens = this.estimateTokenCount(summary.summary);
        if (result.tokenCount + estimatedTokens <= maxTokens * 0.9) { // Use up to 90% total
          result.summaries.push(summary);
          result.tokenCount += estimatedTokens;
        }
      }

      // Add relationships (structural information)
      for (const relationship of searchResult.relationships) {
        const estimatedTokens = this.estimateTokenCount(
          `${relationship.sourceEntity} ${relationship.relationshipType} ${relationship.targetEntity}`
        );
        if (result.tokenCount + estimatedTokens <= maxTokens) {
          result.relationships.push(relationship);
          result.tokenCount += estimatedTokens;
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to get relevant memory:', error);
      return {
        facts: [],
        summaries: [],
        relationships: [],
        tokenCount: 0
      };
    }
  }

  /**
   * Clean up old memory data
   * Requirements: 8.5
   */
  async cleanupMemory(conversationId: string, retentionDays: number = 30): Promise<{
    factsDeleted: number;
    summariesDeleted: number;
    relationshipsDeleted: number;
  }> {
    return await this.memoryRepository.cleanupOldMemory(conversationId, retentionDays);
  }

  /**
   * Get memory statistics
   * Requirements: 8.2, 8.5
   */
  async getMemoryStats(conversationId: string) {
    return await this.memoryRepository.getMemoryStats(conversationId);
  }

  /**
   * Estimate token count for text (rough approximation)
   * Requirements: 8.5
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if the memory system is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.vectorEmbeddings.isReady();
  }

  /**
   * Shutdown the memory system
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    this.isInitialized = false;
  }
}