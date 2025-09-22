import { Database } from '../Database';

/**
 * Base class for database migrations
 * Requirements: 6.3, 8.2
 */
export abstract class Migration {
  constructor(
    public readonly version: string,
    public readonly description: string
  ) {}

  /**
   * Apply the migration
   */
  abstract up(database: Database): Promise<void>;

  /**
   * Rollback the migration
   */
  abstract down(database: Database): Promise<void>;
}

/**
 * Migration manager for handling database schema changes
 * Requirements: 6.3, 8.2
 */
export class MigrationManager {
  private migrations: Migration[] = [];

  constructor(private database: Database) {}

  /**
   * Register a migration
   */
  addMigration(migration: Migration): void {
    this.migrations.push(migration);
    // Sort by version to ensure proper order
    this.migrations.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
    await this.database['executeQuery'](`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<string[]> {
    const results = await this.database['executeQuery']<any[]>(
      'SELECT version FROM schema_migrations ORDER BY version',
      [],
      'all'
    );
    return results.map(row => row.version);
  }

  /**
   * Apply pending migrations
   */
  async migrate(): Promise<void> {
    await this.initializeMigrationTable();
    const appliedMigrations = await this.getAppliedMigrations();

    for (const migration of this.migrations) {
      if (!appliedMigrations.includes(migration.version)) {
        console.log(`Applying migration ${migration.version}: ${migration.description}`);
        
        try {
          await migration.up(this.database);
          
          // Record successful migration
          await this.database['executeQuery'](
            'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
            [migration.version, migration.description]
          );
          
          console.log(`Migration ${migration.version} applied successfully`);
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
  }

  /**
   * Rollback to a specific version
   */
  async rollbackTo(targetVersion: string): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationsToRollback = this.migrations
      .filter(m => appliedMigrations.includes(m.version))
      .filter(m => m.version > targetVersion)
      .reverse(); // Rollback in reverse order

    for (const migration of migrationsToRollback) {
      console.log(`Rolling back migration ${migration.version}: ${migration.description}`);
      
      try {
        await migration.down(this.database);
        
        // Remove migration record
        await this.database['executeQuery'](
          'DELETE FROM schema_migrations WHERE version = ?',
          [migration.version]
        );
        
        console.log(`Migration ${migration.version} rolled back successfully`);
      } catch (error) {
        console.error(`Rollback of migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<Array<{
    version: string;
    description: string;
    applied: boolean;
    appliedAt?: Date;
  }>> {
    await this.initializeMigrationTable();
    const appliedMigrations = await this.database['executeQuery']<any[]>(
      'SELECT version, applied_at FROM schema_migrations',
      [],
      'all'
    );

    const appliedMap = new Map(
      appliedMigrations.map(row => [row.version, new Date(row.applied_at)])
    );

    return this.migrations.map(migration => ({
      version: migration.version,
      description: migration.description,
      applied: appliedMap.has(migration.version),
      appliedAt: appliedMap.get(migration.version)
    }));
  }
}