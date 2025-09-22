import { Database } from './Database';
import type { ApplicationConfiguration } from '../types/config';

/**
 * Repository for application configuration storage
 * Requirements: 4.4, 4.5
 */
export class ConfigRepository {
  constructor(private database: Database) {}

  /**
   * Save application configuration
   * Requirements: 4.4, 4.5
   */
  async saveConfig(config: ApplicationConfiguration): Promise<void> {
    const configJson = JSON.stringify(config);
    const now = new Date().toISOString();

    await this.database['executeQuery'](
      `INSERT OR REPLACE INTO app_config (key, value, updated_at) 
       VALUES (?, ?, ?)`,
      ['application_config', configJson, now]
    );
  }

  /**
   * Load application configuration
   * Requirements: 4.4, 4.5
   */
  async loadConfig(): Promise<ApplicationConfiguration | null> {
    const result = await this.database['executeQuery']<any>(
      'SELECT value FROM app_config WHERE key = ?',
      ['application_config'],
      'get'
    );

    if (!result) {
      return null;
    }

    try {
      return JSON.parse(result.value);
    } catch (error) {
      throw new Error(`Failed to parse configuration: ${error}`);
    }
  }

  /**
   * Save a specific configuration section
   * Requirements: 4.4, 4.5
   */
  async saveConfigSection(section: string, value: any): Promise<void> {
    const valueJson = JSON.stringify(value);
    const now = new Date().toISOString();

    await this.database['executeQuery'](
      `INSERT OR REPLACE INTO app_config (key, value, updated_at) 
       VALUES (?, ?, ?)`,
      [`config_${section}`, valueJson, now]
    );
  }

  /**
   * Load a specific configuration section
   * Requirements: 4.4, 4.5
   */
  async loadConfigSection<T>(section: string): Promise<T | null> {
    const result = await this.database['executeQuery']<any>(
      'SELECT value FROM app_config WHERE key = ?',
      [`config_${section}`],
      'get'
    );

    if (!result) {
      return null;
    }

    try {
      return JSON.parse(result.value);
    } catch (error) {
      throw new Error(`Failed to parse configuration section ${section}: ${error}`);
    }
  }

  /**
   * Delete a configuration section
   * Requirements: 4.4, 4.5
   */
  async deleteConfigSection(section: string): Promise<void> {
    await this.database['executeQuery'](
      'DELETE FROM app_config WHERE key = ?',
      [`config_${section}`]
    );
  }

  /**
   * Get all configuration keys
   * Requirements: 4.4, 4.5
   */
  async getAllConfigKeys(): Promise<string[]> {
    const results = await this.database['executeQuery']<any[]>(
      'SELECT key FROM app_config ORDER BY key',
      [],
      'all'
    );

    return results.map(row => row.key);
  }

  /**
   * Clear all configuration data
   * Requirements: 4.4, 4.5
   */
  async clearAllConfig(): Promise<void> {
    await this.database['executeQuery'](
      'DELETE FROM app_config',
      []
    );
  }

  /**
   * Get configuration metadata
   * Requirements: 4.4, 4.5
   */
  async getConfigMetadata(): Promise<Array<{
    key: string;
    updatedAt: Date;
    size: number;
  }>> {
    const results = await this.database['executeQuery']<any[]>(
      'SELECT key, updated_at, LENGTH(value) as size FROM app_config ORDER BY updated_at DESC',
      [],
      'all'
    );

    return results.map(row => ({
      key: row.key,
      updatedAt: new Date(row.updated_at),
      size: row.size
    }));
  }

  /**
   * Backup configuration to JSON
   * Requirements: 4.4, 4.5
   */
  async exportConfig(): Promise<Record<string, any>> {
    const results = await this.database['executeQuery']<any[]>(
      'SELECT key, value FROM app_config',
      [],
      'all'
    );

    const config: Record<string, any> = {};
    for (const row of results) {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch (error) {
        // If parsing fails, store as string
        config[row.key] = row.value;
      }
    }

    return config;
  }

  /**
   * Restore configuration from JSON backup
   * Requirements: 4.4, 4.5
   */
  async importConfig(config: Record<string, any>): Promise<void> {
    const now = new Date().toISOString();

    // Clear existing config
    await this.clearAllConfig();

    // Insert new config
    for (const [key, value] of Object.entries(config)) {
      const valueJson = typeof value === 'string' ? value : JSON.stringify(value);
      await this.database['executeQuery'](
        `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, valueJson, now]
      );
    }
  }
}