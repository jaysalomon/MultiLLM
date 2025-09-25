import initSqlJs, { Database as SQLDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import type {
  ChatMessage,
  ConversationState,
  ModelParticipant
} from '../types/chat';
import type {
  SharedMemoryContext,
  MemoryFact,
  ConversationSummary,
  EntityRelationship
} from '../types/memory';
import type { ApplicationConfiguration } from '../types/config';

/**
 * SQLite database wrapper for the multi-LLM chat application using sql.js
 * Requirements: 6.3, 9.3, 8.2
 */
export class Database {
  private db: SQLDatabase | null = null;
  private dbPath: string;
  private isInitialized = false;
  private SQL: any;

  constructor(dbPath?: string) {
    const userDataPath = app?.getPath('userData') || './data';
    this.dbPath = dbPath || path.join(userDataPath, 'multi-llm-chat.db');

    // Don't create directories for in-memory database
    if (this.dbPath !== ':memory:') {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }
  }

  /**
   * Initialize the database connection and create tables
   * Requirements: 6.3, 8.2
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.SQL = await initSqlJs({
        locateFile: (file: string) => `node_modules/sql.js/dist/${file}`
      });

      let buffer: Uint8Array | undefined;
      if (fs.existsSync(this.dbPath)) {
        buffer = new Uint8Array(fs.readFileSync(this.dbPath));
      }

      this.db = new this.SQL.Database(buffer);

      this.db!.run('PRAGMA foreign_keys = ON');
      this.db!.run('PRAGMA journal_mode = WAL');
      this.db!.run('PRAGMA synchronous = NORMAL');

      await this.createTables();
      this.isInitialized = true;

      await this.save();
    } catch (error: any) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  /**
   * Save database to disk
   */
  private async save(): Promise<void> {
    if (!this.db || this.dbPath === ':memory:') return;
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /**
   * Check if the database is ready/initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Get the underlying SQL database instance
   */
  getDatabase(): SQLDatabase | null {
    return this.db;
  }

  /**
   * Get the database file path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Create all necessary database tables
   * Requirements: 6.3, 8.2, 9.3
   */
  private async createTables(): Promise<void> {
    const tables = [
      // Conversations table
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'active',
        metadata TEXT
      )`,

      // Model participants table
      `CREATE TABLE IF NOT EXISTS model_participants (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        display_name TEXT,
        color TEXT,
        avatar TEXT,
        is_active INTEGER DEFAULT 1,
        joined_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,

      // Messages table
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        role TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,

      // Memory facts table
      `CREATE TABLE IF NOT EXISTS memory_facts (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        relevance_score REAL NOT NULL,
        tags TEXT,
        embedding BLOB,
        verified INTEGER DEFAULT 0,
        message_references TEXT,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,

      // Conversation summaries table
      `CREATE TABLE IF NOT EXISTS conversation_summaries (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_points TEXT NOT NULL,
        participants TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        embedding BLOB,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,

      // Entity relationships table
      `CREATE TABLE IF NOT EXISTS entity_relationships (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        source_entity TEXT NOT NULL,
        target_entity TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence REAL NOT NULL,
        evidence TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,

      // Tasks table
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      )`,

      // Application configuration table
      `CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Provider configurations table
      `CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Create indexes for better query performance
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id, timestamp)`,

      `CREATE INDEX IF NOT EXISTS idx_participants_conversation
        ON model_participants(conversation_id)`,

      `CREATE INDEX IF NOT EXISTS idx_memory_facts_conversation
        ON memory_facts(conversation_id, relevance_score DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_summaries_conversation
        ON conversation_summaries(conversation_id, start_time DESC)`,

      `CREATE INDEX IF NOT EXISTS idx_relationships_conversation
        ON entity_relationships(conversation_id, confidence DESC)`
    ];

    for (const table of tables) {
      this.db!.run(table);
    }

    // Run migrations for existing databases
    await this.runMigrations();

    await this.save();
  }

  /**
   * Run database migrations for schema updates
   */
  private async runMigrations(): Promise<void> {
    // Migration 1: Update memory_facts table schema
    try {
      // Check if old columns exist and new ones don't
      const memoryFactsColumns = await this.all("PRAGMA table_info(memory_facts)");
      const hasOldSchema = memoryFactsColumns.some((col: any) => col.name === 'importance');
      const hasNewSchema = memoryFactsColumns.some((col: any) => col.name === 'source');

      if (hasOldSchema && !hasNewSchema) {
        // Migrate memory_facts table
        this.db!.run(`ALTER TABLE memory_facts ADD COLUMN source TEXT`);
        this.db!.run(`ALTER TABLE memory_facts ADD COLUMN timestamp TEXT`);
        this.db!.run(`ALTER TABLE memory_facts ADD COLUMN relevance_score REAL`);
        this.db!.run(`ALTER TABLE memory_facts ADD COLUMN tags TEXT`);
        this.db!.run(`ALTER TABLE memory_facts ADD COLUMN verified INTEGER DEFAULT 0`);
        this.db!.run(`ALTER TABLE memory_facts ADD COLUMN message_references TEXT`);

        // Migrate existing data
        this.db!.run(`UPDATE memory_facts SET 
          source = 'unknown',
          timestamp = datetime('now'),
          relevance_score = importance,
          tags = '[]',
          verified = 0,
          message_references = '[]'
          WHERE source IS NULL`);

        // Drop old column
        this.db!.run(`ALTER TABLE memory_facts DROP COLUMN importance`);
        this.db!.run(`ALTER TABLE memory_facts DROP COLUMN created_at`);
        this.db!.run(`ALTER TABLE memory_facts DROP COLUMN metadata`);
      }
    } catch (error) {
      console.warn('Migration for memory_facts failed:', error);
    }

    // Migration 2: Update conversation_summaries table schema
    try {
      const summaryColumns = await this.all("PRAGMA table_info(conversation_summaries)");
      const hasOldSummarySchema = summaryColumns.some((col: any) => col.name === 'message_range_start');
      const hasNewSummarySchema = summaryColumns.some((col: any) => col.name === 'start_time');

      if (hasOldSummarySchema && !hasNewSummarySchema) {
        this.db!.run(`ALTER TABLE conversation_summaries ADD COLUMN start_time TEXT`);
        this.db!.run(`ALTER TABLE conversation_summaries ADD COLUMN end_time TEXT`);
        this.db!.run(`ALTER TABLE conversation_summaries ADD COLUMN participants TEXT`);
        this.db!.run(`ALTER TABLE conversation_summaries ADD COLUMN message_count INTEGER`);
        this.db!.run(`ALTER TABLE conversation_summaries ADD COLUMN embedding BLOB`);
        this.db!.run(`ALTER TABLE conversation_summaries ADD COLUMN created_by TEXT`);

        // Migrate existing data
        this.db!.run(`UPDATE conversation_summaries SET 
          start_time = datetime('now', '-1 hour'),
          end_time = datetime('now'),
          participants = '["unknown"]',
          message_count = 0,
          created_by = 'system'
          WHERE start_time IS NULL`);

        // Drop old columns
        this.db!.run(`ALTER TABLE conversation_summaries DROP COLUMN message_range_start`);
        this.db!.run(`ALTER TABLE conversation_summaries DROP COLUMN message_range_end`);
      }
    } catch (error) {
      console.warn('Migration for conversation_summaries failed:', error);
    }

    // Migration 3: Update entity_relationships table schema
    try {
      const relationshipColumns = await this.all("PRAGMA table_info(entity_relationships)");
      const hasOldRelationshipSchema = relationshipColumns.some((col: any) => col.name === 'entity1');
      const hasNewRelationshipSchema = relationshipColumns.some((col: any) => col.name === 'source_entity');

      if (hasOldRelationshipSchema && !hasNewRelationshipSchema) {
        this.db!.run(`ALTER TABLE entity_relationships ADD COLUMN source_entity TEXT`);
        this.db!.run(`ALTER TABLE entity_relationships ADD COLUMN target_entity TEXT`);
        this.db!.run(`ALTER TABLE entity_relationships ADD COLUMN relationship_type TEXT`);
        this.db!.run(`ALTER TABLE entity_relationships ADD COLUMN confidence REAL`);
        this.db!.run(`ALTER TABLE entity_relationships ADD COLUMN evidence TEXT`);
        this.db!.run(`ALTER TABLE entity_relationships ADD COLUMN created_by TEXT`);

        // Migrate existing data
        this.db!.run(`UPDATE entity_relationships SET 
          source_entity = entity1,
          target_entity = entity2,
          relationship_type = relationship,
          confidence = strength,
          evidence = '[]',
          created_by = 'system'
          WHERE source_entity IS NULL`);

        // Drop old columns
        this.db!.run(`ALTER TABLE entity_relationships DROP COLUMN entity1`);
        this.db!.run(`ALTER TABLE entity_relationships DROP COLUMN entity2`);
        this.db!.run(`ALTER TABLE entity_relationships DROP COLUMN relationship`);
        this.db!.run(`ALTER TABLE entity_relationships DROP COLUMN strength`);
      }
    } catch (error) {
      console.warn('Migration for entity_relationships failed:', error);
    }
  }

  /**
   * Execute a SQL query and return all results
   * Requirements: 6.3
   */
  async all(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);

      const results: any[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (error: any) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * Execute a SQL query and return first result
   * Requirements: 6.3
   */
  async get(sql: string, params: any[] = []): Promise<any> {
    const results = await this.all(sql, params);
    return results[0];
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   * Requirements: 6.3
   */
  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();

      // Persist changes for write operations
      await this.save();
    } catch (error: any) {
      throw new Error(`Database statement failed: ${error.message}`);
    }
  }

  /**
   * Save a conversation to the database
   * Requirements: 9.3
   */
  async saveConversation(conversation: ConversationState): Promise<void> {
    const conversationData = {
      id: conversation.id,
      title: `Conversation ${conversation.id}`,
      created_at: conversation.createdAt.getTime(),
      updated_at: conversation.updatedAt.getTime(),
      state: 'active',
      metadata: JSON.stringify({})
    };

    await this.run(
      `INSERT OR REPLACE INTO conversations
        (id, title, created_at, updated_at, state, metadata)
        VALUES (?, ?, ?, ?, ?, ?)`,
      Object.values(conversationData)
    );

    for (const message of conversation.messages) {
      await this.saveMessage(conversation.id, message);
    }

    for (const participant of conversation.participants) {
      await this.saveParticipant(conversation.id, participant);
    }
  }

  /**
   * Save a message to the database
   * Requirements: 9.3
   */
  async saveMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const messageData = {
      id: message.id,
      conversation_id: conversationId,
      sender: message.sender,
      content: message.content,
      role: message.sender === 'user' ? 'user' : 'assistant',
      timestamp: message.timestamp.getTime(),
      metadata: JSON.stringify(message.metadata || {})
    };

    await this.run(
      `INSERT OR REPLACE INTO messages
        (id, conversation_id, sender, content, role, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      Object.values(messageData)
    );
  }

  /**
   * Save a model participant to the database
   * Requirements: 9.3
   */
  async saveParticipant(conversationId: string, participant: ModelParticipant): Promise<void> {
    const participantData = {
      id: participant.id,
      conversation_id: conversationId,
      provider_id: participant.provider?.id || 'unknown',
      model_name: participant.modelName,
      display_name: participant.displayName || null,
      color: participant.color || null,
      avatar: participant.avatar || null,
      is_active: participant.isActive ? 1 : 0,
      joined_at: participant.addedAt.getTime(),
      metadata: JSON.stringify({})
    };

    await this.run(
      `INSERT OR REPLACE INTO model_participants
        (id, conversation_id, provider_id, model_name, display_name, color, avatar, is_active, joined_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      Object.values(participantData)
    );
  }

  /**
   * Load a conversation from the database
   * Requirements: 9.1
   */
  async loadConversation(conversationId: string): Promise<ConversationState | null> {
    const conversationRow = await this.get(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (!conversationRow) {
      return null;
    }

    const messages = await this.all(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp',
      [conversationId]
    );

    const participants = await this.all(
      'SELECT * FROM model_participants WHERE conversation_id = ?',
      [conversationId]
    );

    return {
      id: conversationRow.id,
      createdAt: new Date(conversationRow.created_at),
      updatedAt: new Date(conversationRow.updated_at),
      messages: messages.map(m => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        role: m.role,
        timestamp: new Date(m.timestamp),
        metadata: JSON.parse(m.metadata || '{}')
      })),
      participants: participants.map(p => ({
        id: p.id,
        provider: null as any,
        modelName: p.model_name,
        displayName: p.display_name,
        color: p.color,
        avatar: p.avatar,
        isActive: p.is_active === 1,
        addedAt: new Date(p.joined_at)
      })),
      sharedMemory: {
        conversationId: conversationRow.id,
        facts: [],
        summaries: [],
        relationships: [],
        lastUpdated: new Date(conversationRow.updated_at),
        version: 1
      }
    };
  }

  /**
   * Get all conversations (metadata only, not full messages)
   * Requirements: 9.1
   */
  async getAllConversations(): Promise<ConversationState[]> {
    const conversations = await this.all(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );

    return Promise.all(conversations.map(c => this.loadConversation(c.id).then(conv => conv!)));
  }

  /**
   * Delete a conversation
   * Requirements: 9.3
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
  }

  /**
   * Search conversations by content
   * Requirements: 9.2
   */
  async searchConversations(query: string): Promise<ConversationState[]> {
    const messageMatches = await this.all(
      `SELECT DISTINCT conversation_id FROM messages
       WHERE content LIKE ?
       ORDER BY timestamp DESC`,
      [`%${query}%`]
    );

    const conversationIds = messageMatches.map(m => m.conversation_id);
    const conversations = await Promise.all(
      conversationIds.map(id => this.loadConversation(id))
    );

    return conversations.filter(c => c !== null) as ConversationState[];
  }

  /**
   * Save memory facts
   * Requirements: 8.2
   */
  async saveMemoryFact(conversationId: string, fact: MemoryFact): Promise<void> {
    // Store memory facts using current schema columns:
    // (id, conversation_id, content, source, timestamp, relevance_score, tags, embedding, verified, message_references)
    const factData = {
      id: fact.id,
      conversation_id: conversationId,
      content: fact.content,
      source: fact.source || 'unknown',
      timestamp: fact.timestamp instanceof Date ? fact.timestamp.toISOString() : new Date().toISOString(),
      relevance_score: typeof fact.relevanceScore === 'number' ? fact.relevanceScore : 0.5,
      tags: JSON.stringify(fact.tags || []),
      embedding: fact.embedding ? JSON.stringify(fact.embedding) : null,
      verified: fact.verified ? 1 : 0,
      message_references: JSON.stringify(fact.references || [])
    };

    await this.run(
      `INSERT OR REPLACE INTO memory_facts
        (id, conversation_id, content, source, timestamp, relevance_score, tags, embedding, verified, message_references)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        factData.id,
        factData.conversation_id,
        factData.content,
        factData.source,
        factData.timestamp,
        factData.relevance_score,
        factData.tags,
        factData.embedding,
        factData.verified,
        factData.message_references
      ]
    );
  }

  /**
   * Get memory facts for a conversation
   * Requirements: 8.1
   */
  async getMemoryFacts(conversationId: string, limit: number = 100): Promise<MemoryFact[]> {
    const facts = await this.all(
      `SELECT * FROM memory_facts
       WHERE conversation_id = ?
       ORDER BY relevance_score DESC
       LIMIT ?`,
      [conversationId, limit]
    );

    return facts.map(f => ({
      id: f.id,
      content: f.content,
      source: f.source || 'conversation',
      timestamp: f.timestamp ? new Date(f.timestamp) : new Date(),
  relevanceScore: typeof f.relevance_score === 'number' ? f.relevance_score : (f.relevanceScore || 0.5),
  tags: f.tags ? JSON.parse(f.tags) : [],
      embedding: f.embedding ? JSON.parse(f.embedding) : undefined,
      extractedEntities: [],
      relationships: [],
      verified: f.verified === 1,
      references: f.message_references ? JSON.parse(f.message_references) : []
    }));
  }

  /**
   * Save conversation summary
   * Requirements: 8.4
   */
  async saveConversationSummary(conversationId: string, summary: ConversationSummary): Promise<void> {
    const summaryData = {
      id: summary.id,
      conversation_id: conversationId,
      start_time: summary.timeRange?.start ? summary.timeRange.start.toISOString() : new Date().toISOString(),
      end_time: summary.timeRange?.end ? summary.timeRange.end.toISOString() : new Date().toISOString(),
      summary: summary.summary,
      key_points: JSON.stringify(summary.keyPoints || []),
      participants: JSON.stringify(summary.participants || []),
      message_count: typeof summary.messageCount === 'number' ? summary.messageCount : 0,
      embedding: summary.embedding ? JSON.stringify(summary.embedding) : null,
      created_by: summary.createdBy || 'system',
      created_at: summary.createdAt ? summary.createdAt.toISOString() : new Date().toISOString()
    };

    await this.run(
      `INSERT OR REPLACE INTO conversation_summaries
        (id, conversation_id, start_time, end_time, summary, key_points, participants, message_count, embedding, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        summaryData.id,
        summaryData.conversation_id,
        summaryData.start_time,
        summaryData.end_time,
        summaryData.summary,
        summaryData.key_points,
        summaryData.participants,
        summaryData.message_count,
        summaryData.embedding,
        summaryData.created_by,
        summaryData.created_at
      ]
    );
  }

  /**
   * Get conversation summaries
   * Requirements: 8.4
   */
  async getConversationSummaries(conversationId: string): Promise<ConversationSummary[]> {
    const summaries = await this.all(
      `SELECT * FROM conversation_summaries
       WHERE conversation_id = ?
       ORDER BY created_at DESC`,
      [conversationId]
    );

    return summaries.map(s => ({
      id: s.id,
      summary: s.summary,
      keyPoints: s.key_points ? JSON.parse(s.key_points) : [],
      createdAt: s.created_at ? new Date(s.created_at) : new Date(),
      timeRange: {
        start: s.start_time ? new Date(s.start_time) : (s.created_at ? new Date(s.created_at) : new Date()),
        end: s.end_time ? new Date(s.end_time) : (s.created_at ? new Date(s.created_at) : new Date())
      },
      participants: s.participants ? JSON.parse(s.participants) : [],
      messageCount: typeof s.message_count === 'number' ? s.message_count : (s.message_range_end && s.message_range_start ? (s.message_range_end - s.message_range_start) : 0),
      createdBy: s.created_by || 'system'
    }));
  }

  /**
   * Save application configuration
   * Requirements: 4.4
   */
  async saveConfig(key: string, value: any): Promise<void> {
    await this.run(
      `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, JSON.stringify(value), Date.now()]
    );
  }

  /**
   * Get application configuration
   * Requirements: 4.4
   */
  async getConfig(key: string): Promise<any> {
    const row = await this.get(
      'SELECT value FROM app_config WHERE key = ?',
      [key]
    );
    return row ? JSON.parse(row.value) : null;
  }

  /**
   * Get all application configuration
   * Requirements: 4.4
   */
  async getAllConfig(): Promise<ApplicationConfiguration> {
    const rows = await this.all('SELECT key, value FROM app_config');
    const config: any = {};

    for (const row of rows) {
      config[row.key] = JSON.parse(row.value);
    }

    return config;
  }

  /**
   * Execute a query with optional return type specification
   * Compatibility method for repository pattern
   */
  async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    type: 'all' | 'get' | 'run' = 'run'
  ): Promise<T> {
    if (type === 'all') {
      return await this.all(sql, params) as T;
    } else if (type === 'get') {
      return await this.get(sql, params) as T;
    } else {
      await this.run(sql, params);
      return undefined as any as T;
    }
  }

  /**
   * Get last insert row ID (compatibility)
   */
  getLastInsertRowId(): number {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    // sql.js doesn't have lastInsertRowid, return 0 for compatibility
    return 0;
  }

  /**
   * Get changes count (compatibility)
   */
  getChanges(): number {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    // sql.js doesn't have changes count, return 0 for compatibility
    return 0;
  }



  /**
   * Close the database connection
   * For sql.js, this saves the database if it's file-based
   */
  async close(): Promise<void> {
    if (this.db && this.dbPath !== ':memory:') {
      await this.save();
    }
    // sql.js doesn't require explicit closing
  }
}