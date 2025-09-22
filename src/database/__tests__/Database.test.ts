import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../Database';
import fs from 'fs';
import path from 'path';

describe('Database', () => {
  let database: Database;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database file for testing
    testDbPath = path.join(__dirname, 'test.db');
    database = new Database(testDbPath);
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(database.isReady()).toBe(true);
    });

    it('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create all required tables', async () => {
      const db = database.getDatabase();
      
      // Check if tables exist
      const tables = await new Promise<any[]>((resolve, reject) => {
        db.all(
          "SELECT name FROM sqlite_master WHERE type='table'",
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const tableNames = tables.map(t => t.name);
      
      expect(tableNames).toContain('conversations');
      expect(tableNames).toContain('messages');
      expect(tableNames).toContain('model_participants');
      expect(tableNames).toContain('memory_facts');
      expect(tableNames).toContain('conversation_summaries');
      expect(tableNames).toContain('entity_relationships');
      expect(tableNames).toContain('app_config');
    });

    it('should create indexes', async () => {
      const db = database.getDatabase();
      
      const indexes = await new Promise<any[]>((resolve, reject) => {
        db.all(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(indexes.length).toBeGreaterThan(0);
      
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_messages_conversation_id');
      expect(indexNames).toContain('idx_messages_timestamp');
      expect(indexNames).toContain('idx_conversations_updated_at');
    });
  });

  describe('connection management', () => {
    it('should close connection properly', async () => {
      await database.close();
      expect(database.isReady()).toBe(false);
    });

    it('should handle multiple initialization calls', async () => {
      await database.initialize();
      await database.initialize(); // Should not throw
      expect(database.isReady()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error when accessing closed database', async () => {
      await database.close();
      
      expect(() => database.getDatabase()).toThrow('Database not initialized');
    });

    it('should handle invalid database path gracefully', async () => {
      // Test with a path that will cause directory creation to fail
      expect(() => {
        new Database('C:\\invalid<>path\\test.db');
      }).toThrow();
    });
  });

  describe('PRAGMA settings', () => {
    it('should enable foreign keys', async () => {
      const db = database.getDatabase();
      
      const result = await new Promise<any>((resolve, reject) => {
        db.get('PRAGMA foreign_keys', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(result.foreign_keys).toBe(1);
    });

    it('should set WAL mode', async () => {
      const db = database.getDatabase();
      
      const result = await new Promise<any>((resolve, reject) => {
        db.get('PRAGMA journal_mode', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(result.journal_mode).toBe('wal');
    });
  });
});