import { Database } from './Database';
import { ConversationRepository } from './ConversationRepository';
import { MemoryRepository } from './MemoryRepository';
import { ConfigRepository } from './ConfigRepository';
import { MigrationManager } from './migrations/Migration';
import { InitialSchemaMigration } from './migrations/001_initial_schema';

/**
 * Main database manager that provides access to all repositories
 * Requirements: 6.3, 8.2, 9.3
 */
export class DatabaseManager {
  private database: Database;
  private migrationManager: MigrationManager;
  
  public readonly conversations: ConversationRepository;
  public readonly memory: MemoryRepository;
  public readonly config: ConfigRepository;

  constructor(dbPath?: string) {
    this.database = new Database(dbPath);
    this.migrationManager = new MigrationManager(this.database);
    
    // Initialize repositories
    this.conversations = new ConversationRepository(this.database);
    this.memory = new MemoryRepository(this.database);
    this.config = new ConfigRepository(this.database);

    // Register migrations
    this.migrationManager.addMigration(new InitialSchemaMigration());
  }

  /**
   * Initialize the database and run migrations
   * Requirements: 6.3, 8.2
   */
  async initialize(): Promise<void> {
    try {
      await this.database.initialize();
      await this.migrationManager.migrate();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.database.close();
  }

  /**
   * Get the underlying database instance
   */
  getDatabase(): Database {
    return this.database;
  }

  /**
   * Get migration manager
   */
  getMigrationManager(): MigrationManager {
    return this.migrationManager;
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.database.isReady();
  }

  /**
   * Get database file path
   */
  getDatabasePath(): string {
    return this.database.getPath();
  }

  /**
   * Check if database is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      return this.database.isReady();
    } catch (error) {
      return false;
    }
  }

  /**
   * Perform database maintenance operations
   * Requirements: 8.2, 8.5
   */
  async performMaintenance(options: {
    vacuum?: boolean;
    analyze?: boolean;
    cleanupOldMemory?: boolean;
    retentionDays?: number;
  } = {}): Promise<{
    vacuumCompleted: boolean;
    analyzeCompleted: boolean;
    memoryCleanupResults?: Array<{
      conversationId: string;
      factsDeleted: number;
      summariesDeleted: number;
      relationshipsDeleted: number;
    }>;
  }> {
    const results = {
      vacuumCompleted: false,
      analyzeCompleted: false,
      memoryCleanupResults: undefined as any
    };

    // Vacuum database to reclaim space
    if (options.vacuum) {
      try {
        await this.database['executeQuery']('VACUUM');
        results.vacuumCompleted = true;
        console.log('Database vacuum completed');
      } catch (error) {
        console.error('Database vacuum failed:', error);
      }
    }

    // Analyze database for query optimization
    if (options.analyze) {
      try {
        await this.database['executeQuery']('ANALYZE');
        results.analyzeCompleted = true;
        console.log('Database analyze completed');
      } catch (error) {
        console.error('Database analyze failed:', error);
      }
    }

    // Clean up old memory data
    if (options.cleanupOldMemory) {
      const retentionDays = options.retentionDays || 30;
      try {
        // Get all conversation IDs
        const conversations = await this.conversations.getAllConversations();
        const cleanupResults = [];

        for (const conv of conversations) {
          const result = await this.memory.cleanupOldMemory(conv.id, retentionDays);
          if (result.factsDeleted > 0 || result.summariesDeleted > 0 || result.relationshipsDeleted > 0) {
            cleanupResults.push({
              conversationId: conv.id,
              ...result
            });
          }
        }

        results.memoryCleanupResults = cleanupResults;
        console.log(`Memory cleanup completed for ${cleanupResults.length} conversations`);
      } catch (error) {
        console.error('Memory cleanup failed:', error);
      }
    }

    return results;
  }

  /**
   * Get database statistics
   * Requirements: 9.3
   */
  async getStatistics(): Promise<{
    totalConversations: number;
    totalMessages: number;
    totalParticipants: number;
    totalMemoryFacts: number;
    totalSummaries: number;
    totalRelationships: number;
    databaseSize: number; // in bytes
    oldestConversation?: Date;
    newestConversation?: Date;
  }> {
    const stats = await this.database['executeQuery']<any>(
      `SELECT 
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(DISTINCT m.id) as total_messages,
        COUNT(DISTINCT mp.id) as total_participants,
        COUNT(DISTINCT mf.id) as total_memory_facts,
        COUNT(DISTINCT cs.id) as total_summaries,
        COUNT(DISTINCT er.id) as total_relationships,
        MIN(c.created_at) as oldest_conversation,
        MAX(c.created_at) as newest_conversation
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       LEFT JOIN model_participants mp ON c.id = mp.conversation_id
       LEFT JOIN memory_facts mf ON c.id = mf.conversation_id
       LEFT JOIN conversation_summaries cs ON c.id = cs.conversation_id
       LEFT JOIN entity_relationships er ON c.id = er.conversation_id`,
      [],
      'get'
    );

    // Get database file size
    let databaseSize = 0;
    try {
      const sizeResult = await this.database['executeQuery']<any>(
        'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()',
        [],
        'get'
      );
      databaseSize = sizeResult?.size || 0;
    } catch (error) {
      console.warn('Could not get database size:', error);
    }

    return {
      totalConversations: stats?.total_conversations || 0,
      totalMessages: stats?.total_messages || 0,
      totalParticipants: stats?.total_participants || 0,
      totalMemoryFacts: stats?.total_memory_facts || 0,
      totalSummaries: stats?.total_summaries || 0,
      totalRelationships: stats?.total_relationships || 0,
      databaseSize,
      oldestConversation: stats?.oldest_conversation ? new Date(stats.oldest_conversation) : undefined,
      newestConversation: stats?.newest_conversation ? new Date(stats.newest_conversation) : undefined
    };
  }

  /**
   * Export database to JSON
   * Requirements: 9.2, 9.3
   */
  async exportToJson(): Promise<{
    conversations: any[];
    config: any;
    exportedAt: Date;
    version: string;
  }> {
    const conversations = await this.conversations.getAllConversations();
    const fullConversations = [];

    for (const conv of conversations) {
      const fullConv = await this.conversations.getConversation(conv.id);
      if (fullConv) {
        // Include memory data
        const sharedMemory = await this.memory.getSharedMemory(conv.id);
        fullConversations.push({
          ...fullConv,
          sharedMemory
        });
      }
    }

    const config = await this.config.exportConfig();

    return {
      conversations: fullConversations,
      config,
      exportedAt: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Import database from JSON
   * Requirements: 9.2, 9.3
   */
  async importFromJson(data: {
    conversations: any[];
    config: any;
    exportedAt: string;
    version: string;
  }): Promise<void> {
    // Import configuration
    if (data.config) {
      await this.config.importConfig(data.config);
    }

    // Import conversations
    for (const convData of data.conversations) {
      // Create conversation
      const conversationId = await this.conversations.createConversation(convData.title);

      // Add participants
      for (const participant of convData.participants) {
        await this.conversations.addParticipant(conversationId, {
          ...participant,
          id: participant.id || require('uuid').v4()
        });
      }

      // Add messages
      for (const message of convData.messages) {
        await this.conversations.addMessage({
          ...message,
          metadata: {
            ...message.metadata,
            conversationId
          }
        });
      }

      // Add memory data
      if (convData.sharedMemory) {
        const memory = convData.sharedMemory;
        
        // Add facts
        for (const fact of memory.facts || []) {
          await this.memory.addFact(conversationId, fact);
        }

        // Add summaries
        for (const summary of memory.summaries || []) {
          await this.memory.addSummary(conversationId, summary);
        }

        // Add relationships
        for (const relationship of memory.relationships || []) {
          await this.memory.addRelationship(conversationId, relationship);
        }
      }
    }
  }
}