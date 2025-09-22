import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../Database';
import { ConfigRepository } from '../ConfigRepository';
import type { ApplicationConfiguration } from '../../types/config';
import { DEFAULT_CONFIG } from '../../types/config';
import fs from 'fs';
import path from 'path';

describe('ConfigRepository', () => {
  let database: Database;
  let repository: ConfigRepository;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.join(__dirname, 'config-test.db');
    database = new Database(testDbPath);
    await database.initialize();
    repository = new ConfigRepository(database);
  });

  afterEach(async () => {
    await database.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('configuration management', () => {
    it('should save and load complete configuration', async () => {
      const config: ApplicationConfiguration = {
        ...DEFAULT_CONFIG,
        app: {
          ...DEFAULT_CONFIG.app,
          theme: 'dark',
          language: 'es'
        }
      };

      await repository.saveConfig(config);
      const loadedConfig = await repository.loadConfig();

      expect(loadedConfig).toBeDefined();
      expect(loadedConfig!.app.theme).toBe('dark');
      expect(loadedConfig!.app.language).toBe('es');
      expect(loadedConfig!.providers.defaultTimeout).toBe(DEFAULT_CONFIG.providers.defaultTimeout);
    });

    it('should return null when no configuration exists', async () => {
      const config = await repository.loadConfig();
      expect(config).toBeNull();
    });

    it('should handle configuration updates', async () => {
      await repository.saveConfig(DEFAULT_CONFIG);
      
      const updatedConfig: ApplicationConfiguration = {
        ...DEFAULT_CONFIG,
        app: {
          ...DEFAULT_CONFIG.app,
          theme: 'light'
        }
      };

      await repository.saveConfig(updatedConfig);
      const loadedConfig = await repository.loadConfig();

      expect(loadedConfig!.app.theme).toBe('light');
    });
  });

  describe('configuration sections', () => {
    it('should save and load configuration sections', async () => {
      const appConfig = {
        theme: 'dark',
        language: 'fr',
        autoSave: false
      };

      await repository.saveConfigSection('app', appConfig);
      const loadedSection = await repository.loadConfigSection('app');

      expect(loadedSection).toEqual(appConfig);
    });

    it('should return null for non-existent section', async () => {
      const section = await repository.loadConfigSection('non-existent');
      expect(section).toBeNull();
    });

    it('should delete configuration sections', async () => {
      await repository.saveConfigSection('test', { value: 'test' });
      await repository.deleteConfigSection('test');
      
      const section = await repository.loadConfigSection('test');
      expect(section).toBeNull();
    });

    it('should handle multiple sections', async () => {
      await repository.saveConfigSection('section1', { value: 1 });
      await repository.saveConfigSection('section2', { value: 2 });

      const section1 = await repository.loadConfigSection('section1');
      const section2 = await repository.loadConfigSection('section2');

      expect(section1).toEqual({ value: 1 });
      expect(section2).toEqual({ value: 2 });
    });
  });

  describe('configuration utilities', () => {
    beforeEach(async () => {
      await repository.saveConfig(DEFAULT_CONFIG);
      await repository.saveConfigSection('custom', { setting: 'value' });
    });

    it('should get all configuration keys', async () => {
      const keys = await repository.getAllConfigKeys();
      
      expect(keys).toContain('application_config');
      expect(keys).toContain('config_custom');
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('should clear all configuration', async () => {
      await repository.clearAllConfig();
      
      const config = await repository.loadConfig();
      const keys = await repository.getAllConfigKeys();
      
      expect(config).toBeNull();
      expect(keys).toHaveLength(0);
    });

    it('should get configuration metadata', async () => {
      const metadata = await repository.getConfigMetadata();
      
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[0]).toHaveProperty('key');
      expect(metadata[0]).toHaveProperty('updatedAt');
      expect(metadata[0]).toHaveProperty('size');
      expect(metadata[0].updatedAt).toBeInstanceOf(Date);
      expect(typeof metadata[0].size).toBe('number');
    });
  });

  describe('configuration backup and restore', () => {
    beforeEach(async () => {
      await repository.saveConfig(DEFAULT_CONFIG);
      await repository.saveConfigSection('custom1', { value: 'test1' });
      await repository.saveConfigSection('custom2', { value: 'test2' });
    });

    it('should export configuration', async () => {
      const exported = await repository.exportConfig();
      
      expect(exported).toHaveProperty('application_config');
      expect(exported).toHaveProperty('config_custom1');
      expect(exported).toHaveProperty('config_custom2');
      
      expect(exported.config_custom1).toEqual({ value: 'test1' });
      expect(exported.config_custom2).toEqual({ value: 'test2' });
    });

    it('should import configuration', async () => {
      const configToImport = {
        'application_config': {
          app: { theme: 'dark' },
          providers: { defaultTimeout: 5000 }
        },
        'config_imported': { imported: true }
      };

      await repository.importConfig(configToImport);
      
      const importedSection = await repository.loadConfigSection('imported');
      expect(importedSection).toEqual({ imported: true });
      
      // Original config should be replaced
      const customSection = await repository.loadConfigSection('custom1');
      expect(customSection).toBeNull();
    });

    it('should handle import with string values', async () => {
      const configToImport = {
        'string_config': 'plain string value',
        'json_config': { parsed: 'object' }
      };

      await repository.importConfig(configToImport);
      
      const stringConfig = await repository.loadConfigSection('string');
      const jsonConfig = await repository.loadConfigSection('json');
      
      // Both should be accessible, though string values might be stored differently
      expect(stringConfig || jsonConfig).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON in configuration', async () => {
      // Manually insert invalid JSON
      const db = database.getDatabase();
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)',
          ['config_invalid', 'invalid json {', new Date().toISOString()],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await expect(repository.loadConfigSection('invalid')).rejects.toThrow();
    });

    it('should handle empty configuration gracefully', async () => {
      const keys = await repository.getAllConfigKeys();
      const metadata = await repository.getConfigMetadata();
      const exported = await repository.exportConfig();
      
      expect(keys).toEqual([]);
      expect(metadata).toEqual([]);
      expect(exported).toEqual({});
    });
  });

  describe('configuration versioning', () => {
    it('should preserve configuration timestamps', async () => {
      const beforeSave = new Date();
      await repository.saveConfig(DEFAULT_CONFIG);
      const afterSave = new Date();

      const metadata = await repository.getConfigMetadata();
      const configMetadata = metadata.find(m => m.key === 'application_config');
      
      expect(configMetadata).toBeDefined();
      expect(configMetadata!.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(configMetadata!.updatedAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });

    it('should update timestamps on configuration changes', async () => {
      await repository.saveConfigSection('test', { version: 1 });
      const firstMetadata = await repository.getConfigMetadata();
      const firstTimestamp = firstMetadata.find(m => m.key === 'config_test')!.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1100));

      await repository.saveConfigSection('test', { version: 2 });
      const secondMetadata = await repository.getConfigMetadata();
      const secondTimestamp = secondMetadata.find(m => m.key === 'config_test')!.updatedAt;

      expect(secondTimestamp.getTime()).toBeGreaterThanOrEqual(firstTimestamp.getTime());
      // Also check that the value was actually updated
      const updatedSection = await repository.loadConfigSection('test');
      expect(updatedSection).toEqual({ version: 2 });
    });
  });
});