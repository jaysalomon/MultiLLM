import { Database } from './Database';
import type { 
  ChatMessage, 
  ConversationState, 
  ModelParticipant 
} from '../types/chat';
import type { SharedMemoryContext } from '../types/memory';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for conversation-related database operations
 * Requirements: 6.3, 9.3
 */
export class ConversationRepository {
  constructor(private database: Database) {}

  /**
   * Create a new conversation
   * Requirements: 6.3
   */
  async createConversation(title?: string): Promise<string> {
    const conversationId = uuidv4();
    const now = new Date().toISOString();

    await this.database['executeQuery'](
      `INSERT INTO conversations (id, created_at, updated_at, title) 
       VALUES (?, ?, ?, ?)`,
      [conversationId, now, now, title || 'New Conversation']
    );

    return conversationId;
  }

  /**
   * Get a conversation by ID with all related data
   * Requirements: 6.3, 9.3
   */
  async getConversation(conversationId: string): Promise<ConversationState | null> {
    // Get conversation metadata
    const conversation = await this.database['executeQuery']<any>(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId],
      'get'
    );

    if (!conversation) {
      return null;
    }

    // Get messages
    const messages = await this.getMessages(conversationId);

    // Get participants
    const participants = await this.getParticipants(conversationId);

    // Get shared memory (will be implemented in MemoryRepository)
    const sharedMemory: SharedMemoryContext = {
      conversationId,
      facts: [],
      summaries: [],
      relationships: [],
      lastUpdated: new Date(),
      version: 1
    };

    return {
      id: conversation.id,
      participants,
      messages,
      sharedMemory,
      createdAt: new Date(conversation.created_at),
      updatedAt: new Date(conversation.updated_at)
    };
  }

  /**
   * Get all conversations (metadata only)
   * Requirements: 6.3, 9.3
   */
  async getAllConversations(): Promise<Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    participantCount: number;
  }>> {
    const conversations = await this.database['executeQuery']<any[]>(
      `SELECT 
        c.id, 
        c.title, 
        c.created_at, 
        c.updated_at,
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT mp.id) as participant_count
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       LEFT JOIN model_participants mp ON c.id = mp.conversation_id
       GROUP BY c.id, c.title, c.created_at, c.updated_at
       ORDER BY c.updated_at DESC`,
      [],
      'all'
    );

    return conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      messageCount: conv.message_count || 0,
      participantCount: conv.participant_count || 0
    }));
  }

  /**
   * Update conversation metadata
   * Requirements: 6.3
   */
  async updateConversation(conversationId: string, updates: {
    title?: string;
    metadata?: any;
  }): Promise<void> {
    const now = new Date().toISOString();
    const setParts: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (updates.title !== undefined) {
      setParts.push('title = ?');
      params.push(updates.title);
    }

    if (updates.metadata !== undefined) {
      setParts.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    params.push(conversationId);

    await this.database['executeQuery'](
      `UPDATE conversations SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Delete a conversation and all related data
   * Requirements: 6.3, 9.3
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // Foreign key constraints will handle cascading deletes
    await this.database['executeQuery'](
      'DELETE FROM conversations WHERE id = ?',
      [conversationId]
    );
  }

  /**
   * Add a message to a conversation
   * Requirements: 6.3
   */
  async addMessage(message: ChatMessage): Promise<void> {
    await this.database['executeQuery'](
      `INSERT INTO messages (id, conversation_id, content, sender, timestamp, reply_to, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        this.extractConversationId(message),
        message.content,
        message.sender,
        message.timestamp.toISOString(),
        message.replyTo || null,
        message.metadata ? JSON.stringify(message.metadata) : null
      ]
    );

    // Update conversation timestamp
    await this.updateConversationTimestamp(this.extractConversationId(message));
  }

  /**
   * Get messages for a conversation
   * Requirements: 6.3
   */
  async getMessages(conversationId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
    let query = `
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp ASC
    `;
    const params: any[] = [conversationId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
      
      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }
    }

    const rows = await this.database['executeQuery']<any[]>(query, params, 'all');

    return rows.map(row => ({
      id: row.id,
      content: row.content,
      sender: row.sender,
      timestamp: new Date(row.timestamp),
      replyTo: row.reply_to || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Update a message
   * Requirements: 6.3
   */
  async updateMessage(messageId: string, updates: {
    content?: string;
    metadata?: any;
  }): Promise<void> {
    const setParts: string[] = [];
    const params: any[] = [];

    if (updates.content !== undefined) {
      setParts.push('content = ?');
      params.push(updates.content);
    }

    if (updates.metadata !== undefined) {
      setParts.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    if (setParts.length === 0) {
      return;
    }

    params.push(messageId);

    await this.database['executeQuery'](
      `UPDATE messages SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Delete a message
   * Requirements: 6.3
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.database['executeQuery'](
      'DELETE FROM messages WHERE id = ?',
      [messageId]
    );
  }

  /**
   * Add a model participant to a conversation
   * Requirements: 6.3
   */
  async addParticipant(conversationId: string, participant: ModelParticipant): Promise<void> {
    await this.database['executeQuery'](
      `INSERT INTO model_participants 
       (id, conversation_id, provider_type, provider_config, model_name, display_name, color, avatar, is_active, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        participant.id,
        conversationId,
        participant.provider.type,
        JSON.stringify(participant.provider.config),
        participant.modelName,
        participant.displayName,
        participant.color,
        participant.avatar || null,
        participant.isActive ? 1 : 0,
        participant.addedAt.toISOString()
      ]
    );

    await this.updateConversationTimestamp(conversationId);
  }

  /**
   * Get participants for a conversation
   * Requirements: 6.3
   */
  async getParticipants(conversationId: string): Promise<ModelParticipant[]> {
    const rows = await this.database['executeQuery']<any[]>(
      'SELECT * FROM model_participants WHERE conversation_id = ? ORDER BY added_at ASC',
      [conversationId],
      'all'
    );

    return rows.map(row => ({
      id: row.id,
      provider: {
        id: row.id,
        name: row.display_name,
        type: row.provider_type,
        config: JSON.parse(row.provider_config),
        isActive: Boolean(row.is_active),
        createdAt: new Date(row.added_at),
        updatedAt: new Date(row.added_at)
      },
      modelName: row.model_name,
      displayName: row.display_name,
      color: row.color,
      avatar: row.avatar || undefined,
      isActive: Boolean(row.is_active),
      addedAt: new Date(row.added_at)
    }));
  }

  /**
   * Update a participant
   * Requirements: 6.3
   */
  async updateParticipant(participantId: string, updates: {
    displayName?: string;
    color?: string;
    avatar?: string;
    isActive?: boolean;
  }): Promise<void> {
    const setParts: string[] = [];
    const params: any[] = [];

    if (updates.displayName !== undefined) {
      setParts.push('display_name = ?');
      params.push(updates.displayName);
    }

    if (updates.color !== undefined) {
      setParts.push('color = ?');
      params.push(updates.color);
    }

    if (updates.avatar !== undefined) {
      setParts.push('avatar = ?');
      params.push(updates.avatar);
    }

    if (updates.isActive !== undefined) {
      setParts.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }

    if (setParts.length === 0) {
      return;
    }

    params.push(participantId);

    await this.database['executeQuery'](
      `UPDATE model_participants SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );
  }

  /**
   * Remove a participant from a conversation
   * Requirements: 6.3
   */
  async removeParticipant(participantId: string): Promise<void> {
    await this.database['executeQuery'](
      'DELETE FROM model_participants WHERE id = ?',
      [participantId]
    );
  }

  /**
   * Search conversations by title or content
   * Requirements: 9.3
   */
  async searchConversations(query: string, limit = 50): Promise<Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    matchType: 'title' | 'message';
    snippet?: string;
  }>> {
    const searchTerm = `%${query}%`;
    
    const results = await this.database['executeQuery']<any[]>(
      `SELECT DISTINCT 
        c.id, 
        c.title, 
        c.created_at, 
        c.updated_at,
        CASE 
          WHEN c.title LIKE ? THEN 'title'
          ELSE 'message'
        END as match_type,
        m.content as snippet
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.title LIKE ? OR m.content LIKE ?
       ORDER BY c.updated_at DESC
       LIMIT ?`,
      [searchTerm, searchTerm, searchTerm, limit],
      'all'
    );

    return results.map(row => ({
      id: row.id,
      title: row.title,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      matchType: row.match_type,
      snippet: row.snippet ? row.snippet.substring(0, 200) + '...' : undefined
    }));
  }

  /**
   * Get conversation statistics
   * Requirements: 9.3
   */
  async getConversationStats(conversationId: string): Promise<{
    messageCount: number;
    participantCount: number;
    firstMessageAt?: Date;
    lastMessageAt?: Date;
    totalTokens?: number;
  }> {
    const stats = await this.database['executeQuery']<any>(
      `SELECT 
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT mp.id) as participant_count,
        MIN(m.timestamp) as first_message_at,
        MAX(m.timestamp) as last_message_at
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       LEFT JOIN model_participants mp ON c.id = mp.conversation_id
       WHERE c.id = ?
       GROUP BY c.id`,
      [conversationId],
      'get'
    );

    if (!stats) {
      return {
        messageCount: 0,
        participantCount: 0
      };
    }

    return {
      messageCount: stats.message_count || 0,
      participantCount: stats.participant_count || 0,
      firstMessageAt: stats.first_message_at ? new Date(stats.first_message_at) : undefined,
      lastMessageAt: stats.last_message_at ? new Date(stats.last_message_at) : undefined
    };
  }

  /**
   * Helper method to extract conversation ID from message
   * This is a temporary implementation - in a real app, this would be passed explicitly
   */
  private extractConversationId(message: ChatMessage): string {
    // For now, we'll assume the conversation ID is stored in metadata
    // In a real implementation, this would be passed as a parameter
    return (message.metadata as any)?.conversationId || 'default';
  }

  /**
   * Update conversation timestamp
   */
  private async updateConversationTimestamp(conversationId: string): Promise<void> {
    await this.database['executeQuery'](
      'UPDATE conversations SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), conversationId]
    );
  }
}