import { Migration } from './Migration';
import { Database } from '../Database';

/**
 * Initial database schema migration
 * Requirements: 6.3, 8.2, 9.3
 */
export class InitialSchemaMigration extends Migration {
  constructor() {
    super('001', 'Create initial database schema');
  }

  async up(database: Database): Promise<void> {
    // This migration is handled by the Database.createTables() method
    // We include it here for completeness and future reference
    console.log('Initial schema already created by Database.createTables()');
  }

  async down(database: Database): Promise<void> {
    // Drop all tables in reverse dependency order
    const tables = [
      'entity_relationships',
      'conversation_summaries', 
      'memory_facts',
      'model_participants',
      'messages',
      'conversations',
      'app_config'
    ];

    for (const table of tables) {
      await database['executeQuery'](`DROP TABLE IF EXISTS ${table}`);
    }
  }
}