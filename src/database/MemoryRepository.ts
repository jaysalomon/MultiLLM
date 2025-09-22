import { Database } from './Database';
import type { 
  SharedMemoryContext,
  MemoryFact,
  ConversationSummary,
  EntityRelationship,
  MemorySearchQuery,
  MemorySearchResult
} from '../types/memory';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for shared memory operations
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export class MemoryRepository {
  constructor(private database: Database) {}

  /**
   * Get shared memory context for a conversation
   * Requirements: 8.1, 8.2
   */
  async getSharedMemory(conversationId: string): Promise<SharedMemoryContext> {
    const [facts, summaries, relationships] = await Promise.all([
      this.getFacts(conversationId),
      this.getSummaries(conversationId),
      this.getRelationships(conversationId)
    ]);

    return {
      conversationId,
      facts,
      summaries,
      relationships,
      lastUpdated: new Date(),
      version: 1 // TODO: Implement proper versioning
    };
  }

  /**
   * Add a memory fact
   * Requirements: 8.1, 8.2
   */
  async addFact(conversationId: string, fact: Omit<MemoryFact, 'id'>): Promise<string> {
    const factId = uuidv4();
    
    await this.database['executeQuery'](
      `INSERT INTO memory_facts 
       (id, conversation_id, content, source, timestamp, relevance_score, tags, embedding, verified, message_references)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        factId,
        conversationId,
        fact.content,
        fact.source,
        fact.timestamp.toISOString(),
        fact.relevanceScore,
        JSON.stringify(fact.tags),
        fact.embedding ? Buffer.from(new Float32Array(fact.embedding).buffer) : null,
        fact.verified ? 1 : 0,
        JSON.stringify(fact.references)
      ]
    );

    return factId;
  }

  /**
   * Get facts for a conversation
   * Requirements: 8.1, 8.2
   */
  async getFacts(conversationId: string, limit?: number): Promise<MemoryFact[]> {
    let query = `
      SELECT * FROM memory_facts 
      WHERE conversation_id = ? 
      ORDER BY relevance_score DESC, timestamp DESC
    `;
    const params: any[] = [conversationId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await this.database['executeQuery']<any[]>(query, params, 'all');

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      source: row.source,
      timestamp: new Date(row.timestamp),
      relevanceScore: row.relevance_score,
      tags: JSON.parse(row.tags || '[]'),
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
      verified: Boolean(row.verified),
      references: JSON.parse(row.message_references || '[]')
    }));
  }

  /**
   * Update a memory fact
   * Requirements: 8.1, 8.2
   */
  async updateFact(factId: string, updates: {
    content?: string;
    relevanceScore?: number;
    tags?: string[];
    embedding?: number[];
    verified?: boolean;
    references?: string[];
  }): Promise<void> {
    const setParts: string[] = [];
    const params: any[] = [];

    if (updates.content !== undefined) {
      setParts.push('content = ?');
      params.push(updates.content);
    }

    if (updates.relevanceScore !== undefined) {
      setParts.push('relevance_score = ?');
      params.push(updates.relevanceScore);
    }

    if (updates.tags !== undefined) {
      setParts.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }

    if (updates.embedding !== undefined) {
      setParts.push('embedding = ?');
      params.push(Buffer.from(new Float32Array(updates.embedding).buffer));
    }

    if (updates.verified !== undefined) {
      setParts.push('verified = ?');
      params.push(updates.verified ? 1 : 0);
    }

    if (updates.references !== undefined) {
      setParts.push('message_references = ?');
      params.push(JSON.stringify(updates.references));
    }

    if (setParts.length === 0) {
      return;
    }

    params.push(factId);

    await this.database['executeQuery'](
      `UPDATE memory_facts SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Delete a memory fact
   * Requirements: 8.1, 8.2
   */
  async deleteFact(factId: string): Promise<void> {
    await this.database['executeQuery'](
      'DELETE FROM memory_facts WHERE id = ?',
      [factId]
    );
  }

  /**
   * Add a conversation summary
   * Requirements: 8.3, 8.5
   */
  async addSummary(conversationId: string, summary: Omit<ConversationSummary, 'id'>): Promise<string> {
    const summaryId = uuidv4();
    
    await this.database['executeQuery'](
      `INSERT INTO conversation_summaries 
       (id, conversation_id, start_time, end_time, summary, key_points, participants, message_count, embedding, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        summaryId,
        conversationId,
        summary.timeRange.start.toISOString(),
        summary.timeRange.end.toISOString(),
        summary.summary,
        JSON.stringify(summary.keyPoints),
        JSON.stringify(summary.participants),
        summary.messageCount,
        summary.embedding ? Buffer.from(new Float32Array(summary.embedding).buffer) : null,
        summary.createdBy,
        summary.createdAt.toISOString()
      ]
    );

    return summaryId;
  }

  /**
   * Get summaries for a conversation
   * Requirements: 8.3, 8.5
   */
  async getSummaries(conversationId: string, limit?: number): Promise<ConversationSummary[]> {
    let query = `
      SELECT * FROM conversation_summaries 
      WHERE conversation_id = ? 
      ORDER BY start_time DESC
    `;
    const params: any[] = [conversationId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await this.database['executeQuery']<any[]>(query, params, 'all');

    return rows.map(row => ({
      id: row.id,
      timeRange: {
        start: new Date(row.start_time),
        end: new Date(row.end_time)
      },
      summary: row.summary,
      keyPoints: JSON.parse(row.key_points || '[]'),
      participants: JSON.parse(row.participants || '[]'),
      messageCount: row.message_count,
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Add an entity relationship
   * Requirements: 8.1, 8.4
   */
  async addRelationship(conversationId: string, relationship: Omit<EntityRelationship, 'id'>): Promise<string> {
    const relationshipId = uuidv4();
    
    await this.database['executeQuery'](
      `INSERT INTO entity_relationships 
       (id, conversation_id, source_entity, target_entity, relationship_type, confidence, evidence, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relationshipId,
        conversationId,
        relationship.sourceEntity,
        relationship.targetEntity,
        relationship.relationshipType,
        relationship.confidence,
        JSON.stringify(relationship.evidence),
        relationship.createdBy,
        relationship.createdAt.toISOString()
      ]
    );

    return relationshipId;
  }

  /**
   * Get relationships for a conversation
   * Requirements: 8.1, 8.4
   */
  async getRelationships(conversationId: string, limit?: number): Promise<EntityRelationship[]> {
    let query = `
      SELECT * FROM entity_relationships 
      WHERE conversation_id = ? 
      ORDER BY confidence DESC, created_at DESC
    `;
    const params: any[] = [conversationId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = await this.database['executeQuery']<any[]>(query, params, 'all');

    return rows.map(row => ({
      id: row.id,
      sourceEntity: row.source_entity,
      targetEntity: row.target_entity,
      relationshipType: row.relationship_type,
      confidence: row.confidence,
      evidence: JSON.parse(row.evidence || '[]'),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Search memory using text-based queries
   * Requirements: 8.2, 8.5
   */
  async searchMemory(conversationId: string, query: MemorySearchQuery): Promise<MemorySearchResult> {
    const startTime = Date.now();
    const searchTerm = `%${query.query}%`;
    const results: MemorySearchResult = {
      facts: [],
      summaries: [],
      relationships: [],
      totalResults: 0,
      searchTime: 0
    };

    // Search facts
    if (!query.type || query.type === 'facts' || query.type === 'all') {
      let factQuery = `
        SELECT * FROM memory_facts 
        WHERE conversation_id = ? AND content LIKE ?
      `;
      const factParams: any[] = [conversationId, searchTerm];

      if (query.minRelevanceScore !== undefined) {
        factQuery += ' AND relevance_score >= ?';
        factParams.push(query.minRelevanceScore);
      }

      if (query.timeRange?.start) {
        factQuery += ' AND timestamp >= ?';
        factParams.push(query.timeRange.start.toISOString());
      }

      if (query.timeRange?.end) {
        factQuery += ' AND timestamp <= ?';
        factParams.push(query.timeRange.end.toISOString());
      }

      if (query.sources && query.sources.length > 0) {
        factQuery += ` AND source IN (${query.sources.map(() => '?').join(',')})`;
        factParams.push(...query.sources);
      }

      factQuery += ' ORDER BY relevance_score DESC';

      if (query.limit) {
        factQuery += ' LIMIT ?';
        factParams.push(query.limit);
      }

      const factRows = await this.database['executeQuery']<any[]>(factQuery, factParams, 'all');
      results.facts = factRows.map(row => ({
        id: row.id,
        content: row.content,
        source: row.source,
        timestamp: new Date(row.timestamp),
        relevanceScore: row.relevance_score,
        tags: JSON.parse(row.tags || '[]'),
        embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
        verified: Boolean(row.verified),
        references: JSON.parse(row.references || '[]')
      }));
    }

    // Search summaries
    if (!query.type || query.type === 'summaries' || query.type === 'all') {
      let summaryQuery = `
        SELECT * FROM conversation_summaries 
        WHERE conversation_id = ? AND (summary LIKE ? OR key_points LIKE ?)
      `;
      const summaryParams: any[] = [conversationId, searchTerm, searchTerm];

      if (query.timeRange?.start) {
        summaryQuery += ' AND end_time >= ?';
        summaryParams.push(query.timeRange.start.toISOString());
      }

      if (query.timeRange?.end) {
        summaryQuery += ' AND start_time <= ?';
        summaryParams.push(query.timeRange.end.toISOString());
      }

      summaryQuery += ' ORDER BY start_time DESC';

      if (query.limit) {
        summaryQuery += ' LIMIT ?';
        summaryParams.push(query.limit);
      }

      const summaryRows = await this.database['executeQuery']<any[]>(summaryQuery, summaryParams, 'all');
      results.summaries = summaryRows.map(row => ({
        id: row.id,
        timeRange: {
          start: new Date(row.start_time),
          end: new Date(row.end_time)
        },
        summary: row.summary,
        keyPoints: JSON.parse(row.key_points || '[]'),
        participants: JSON.parse(row.participants || '[]'),
        messageCount: row.message_count,
        embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : undefined,
        createdBy: row.created_by,
        createdAt: new Date(row.created_at)
      }));
    }

    // Search relationships
    if (!query.type || query.type === 'relationships' || query.type === 'all') {
      let relationshipQuery = `
        SELECT * FROM entity_relationships 
        WHERE conversation_id = ? AND (source_entity LIKE ? OR target_entity LIKE ? OR relationship_type LIKE ?)
      `;
      const relationshipParams: any[] = [conversationId, searchTerm, searchTerm, searchTerm];

      if (query.timeRange?.start) {
        relationshipQuery += ' AND created_at >= ?';
        relationshipParams.push(query.timeRange.start.toISOString());
      }

      if (query.timeRange?.end) {
        relationshipQuery += ' AND created_at <= ?';
        relationshipParams.push(query.timeRange.end.toISOString());
      }

      relationshipQuery += ' ORDER BY confidence DESC';

      if (query.limit) {
        relationshipQuery += ' LIMIT ?';
        relationshipParams.push(query.limit);
      }

      const relationshipRows = await this.database['executeQuery']<any[]>(relationshipQuery, relationshipParams, 'all');
      results.relationships = relationshipRows.map(row => ({
        id: row.id,
        sourceEntity: row.source_entity,
        targetEntity: row.target_entity,
        relationshipType: row.relationship_type,
        confidence: row.confidence,
        evidence: JSON.parse(row.evidence || '[]'),
        createdBy: row.created_by,
        createdAt: new Date(row.created_at)
      }));
    }

    results.totalResults = results.facts.length + results.summaries.length + results.relationships.length;
    results.searchTime = Date.now() - startTime;

    return results;
  }

  /**
   * Clean up old memory data based on retention settings
   * Requirements: 8.5
   */
  async cleanupOldMemory(conversationId: string, retentionDays: number): Promise<{
    factsDeleted: number;
    summariesDeleted: number;
    relationshipsDeleted: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    // Delete old facts
    const factsResult = await this.database['executeQuery']<any>(
      'DELETE FROM memory_facts WHERE conversation_id = ? AND timestamp < ?',
      [conversationId, cutoffIso]
    );

    // Delete old summaries
    const summariesResult = await this.database['executeQuery']<any>(
      'DELETE FROM conversation_summaries WHERE conversation_id = ? AND created_at < ?',
      [conversationId, cutoffIso]
    );

    // Delete old relationships
    const relationshipsResult = await this.database['executeQuery']<any>(
      'DELETE FROM entity_relationships WHERE conversation_id = ? AND created_at < ?',
      [conversationId, cutoffIso]
    );

    return {
      factsDeleted: factsResult?.changes || 0,
      summariesDeleted: summariesResult?.changes || 0,
      relationshipsDeleted: relationshipsResult?.changes || 0
    };
  }

  /**
   * Get memory statistics for a conversation
   * Requirements: 8.2, 8.5
   */
  async getMemoryStats(conversationId: string): Promise<{
    factCount: number;
    summaryCount: number;
    relationshipCount: number;
    averageRelevanceScore: number;
    oldestFact?: Date;
    newestFact?: Date;
  }> {
    const stats = await this.database['executeQuery']<any>(
      `SELECT 
        COUNT(DISTINCT f.id) as fact_count,
        COUNT(DISTINCT s.id) as summary_count,
        COUNT(DISTINCT r.id) as relationship_count,
        AVG(f.relevance_score) as avg_relevance_score,
        MIN(f.timestamp) as oldest_fact,
        MAX(f.timestamp) as newest_fact
       FROM conversations c
       LEFT JOIN memory_facts f ON c.id = f.conversation_id
       LEFT JOIN conversation_summaries s ON c.id = s.conversation_id
       LEFT JOIN entity_relationships r ON c.id = r.conversation_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [conversationId],
      'get'
    );

    if (!stats) {
      return {
        factCount: 0,
        summaryCount: 0,
        relationshipCount: 0,
        averageRelevanceScore: 0
      };
    }

    return {
      factCount: stats.fact_count || 0,
      summaryCount: stats.summary_count || 0,
      relationshipCount: stats.relationship_count || 0,
      averageRelevanceScore: stats.avg_relevance_score || 0,
      oldestFact: stats.oldest_fact ? new Date(stats.oldest_fact) : undefined,
      newestFact: stats.newest_fact ? new Date(stats.newest_fact) : undefined
    };
  }
}