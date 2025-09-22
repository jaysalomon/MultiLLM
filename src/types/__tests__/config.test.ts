import { describe, it, expect } from 'vitest';
import type {
  AppConfig,
  WindowSettings,
  ProviderSettings,
  MemorySettings,
  UISettings,
  ExportSettings,
  SecuritySettings,
  ApplicationConfiguration,
  ConfigValidationResult,
} from '../config';
import { DEFAULT_CONFIG } from '../config';

describe('Config Types', () => {
  describe('AppConfig', () => {
    it('should create a valid app config', () => {
      const config: AppConfig = {
        version: '1.0.0',
        theme: 'dark',
        language: 'en',
        autoSave: true,
        autoSaveInterval: 5,
        maxConversationHistory: 1000,
        enableNotifications: true,
        enableSounds: false,
        windowSettings: {
          width: 1200,
          height: 800,
          maximized: false,
          alwaysOnTop: false,
        },
        developerMode: false,
      };

      expect(config.version).toBe('1.0.0');
      expect(config.theme).toBe('dark');
      expect(config.language).toBe('en');
      expect(config.autoSave).toBe(true);
      expect(config.autoSaveInterval).toBe(5);
      expect(config.maxConversationHistory).toBe(1000);
      expect(config.enableNotifications).toBe(true);
      expect(config.enableSounds).toBe(false);
      expect(config.developerMode).toBe(false);
    });

    it('should support all theme options', () => {
      const lightConfig: AppConfig = { ...DEFAULT_CONFIG.app, theme: 'light' };
      const darkConfig: AppConfig = { ...DEFAULT_CONFIG.app, theme: 'dark' };
      const systemConfig: AppConfig = { ...DEFAULT_CONFIG.app, theme: 'system' };

      expect(lightConfig.theme).toBe('light');
      expect(darkConfig.theme).toBe('dark');
      expect(systemConfig.theme).toBe('system');
    });
  });

  describe('WindowSettings', () => {
    it('should create valid window settings', () => {
      const settings: WindowSettings = {
        width: 1400,
        height: 900,
        x: 100,
        y: 50,
        maximized: true,
        alwaysOnTop: true,
      };

      expect(settings.width).toBe(1400);
      expect(settings.height).toBe(900);
      expect(settings.x).toBe(100);
      expect(settings.y).toBe(50);
      expect(settings.maximized).toBe(true);
      expect(settings.alwaysOnTop).toBe(true);
    });

    it('should create window settings without position', () => {
      const settings: WindowSettings = {
        width: 800,
        height: 600,
        maximized: false,
        alwaysOnTop: false,
      };

      expect(settings.x).toBeUndefined();
      expect(settings.y).toBeUndefined();
    });
  });

  describe('ProviderSettings', () => {
    it('should create valid provider settings', () => {
      const settings: ProviderSettings = {
        defaultTimeout: 30000,
        maxRetries: 3,
        retryDelay: 1000,
        enableHealthChecks: true,
        healthCheckInterval: 5,
        maxConcurrentRequests: 5,
      };

      expect(settings.defaultTimeout).toBe(30000);
      expect(settings.maxRetries).toBe(3);
      expect(settings.retryDelay).toBe(1000);
      expect(settings.enableHealthChecks).toBe(true);
      expect(settings.healthCheckInterval).toBe(5);
      expect(settings.maxConcurrentRequests).toBe(5);
    });
  });

  describe('MemorySettings', () => {
    it('should create valid memory settings', () => {
      const settings: MemorySettings = {
        enableSharedMemory: true,
        maxFactsPerConversation: 500,
        maxSummariesPerConversation: 50,
        autoSummarizeThreshold: 100,
        embeddingModel: 'all-MiniLM-L6-v2',
        semanticSearchThreshold: 0.7,
        memoryRetentionDays: 30,
      };

      expect(settings.enableSharedMemory).toBe(true);
      expect(settings.maxFactsPerConversation).toBe(500);
      expect(settings.maxSummariesPerConversation).toBe(50);
      expect(settings.autoSummarizeThreshold).toBe(100);
      expect(settings.embeddingModel).toBe('all-MiniLM-L6-v2');
      expect(settings.semanticSearchThreshold).toBe(0.7);
      expect(settings.memoryRetentionDays).toBe(30);
    });
  });

  describe('UISettings', () => {
    it('should create valid UI settings', () => {
      const settings: UISettings = {
        messageAnimations: true,
        showTimestamps: true,
        showTokenCounts: false,
        showProcessingTimes: false,
        compactMode: false,
        fontSize: 'medium',
        messageGrouping: true,
        enableMarkdown: true,
        enableCodeHighlighting: true,
      };

      expect(settings.messageAnimations).toBe(true);
      expect(settings.showTimestamps).toBe(true);
      expect(settings.showTokenCounts).toBe(false);
      expect(settings.showProcessingTimes).toBe(false);
      expect(settings.compactMode).toBe(false);
      expect(settings.fontSize).toBe('medium');
      expect(settings.messageGrouping).toBe(true);
      expect(settings.enableMarkdown).toBe(true);
      expect(settings.enableCodeHighlighting).toBe(true);
    });

    it('should support all font size options', () => {
      const smallFont: UISettings = { ...DEFAULT_CONFIG.ui, fontSize: 'small' };
      const mediumFont: UISettings = { ...DEFAULT_CONFIG.ui, fontSize: 'medium' };
      const largeFont: UISettings = { ...DEFAULT_CONFIG.ui, fontSize: 'large' };

      expect(smallFont.fontSize).toBe('small');
      expect(mediumFont.fontSize).toBe('medium');
      expect(largeFont.fontSize).toBe('large');
    });
  });

  describe('ExportSettings', () => {
    it('should create valid export settings', () => {
      const settings: ExportSettings = {
        defaultFormat: 'markdown',
        includeMetadata: true,
        includeTimestamps: true,
        includeSharedMemory: false,
        compressExports: false,
      };

      expect(settings.defaultFormat).toBe('markdown');
      expect(settings.includeMetadata).toBe(true);
      expect(settings.includeTimestamps).toBe(true);
      expect(settings.includeSharedMemory).toBe(false);
      expect(settings.compressExports).toBe(false);
    });

    it('should support all export formats', () => {
      const jsonFormat: ExportSettings = { ...DEFAULT_CONFIG.export, defaultFormat: 'json' };
      const markdownFormat: ExportSettings = { ...DEFAULT_CONFIG.export, defaultFormat: 'markdown' };
      const txtFormat: ExportSettings = { ...DEFAULT_CONFIG.export, defaultFormat: 'txt' };

      expect(jsonFormat.defaultFormat).toBe('json');
      expect(markdownFormat.defaultFormat).toBe('markdown');
      expect(txtFormat.defaultFormat).toBe('txt');
    });
  });

  describe('SecuritySettings', () => {
    it('should create valid security settings', () => {
      const settings: SecuritySettings = {
        encryptLocalData: true,
        requireAuthForSensitiveActions: false,
        sessionTimeout: 0,
        clearCredentialsOnExit: false,
        enableAuditLog: false,
      };

      expect(settings.encryptLocalData).toBe(true);
      expect(settings.requireAuthForSensitiveActions).toBe(false);
      expect(settings.sessionTimeout).toBe(0);
      expect(settings.clearCredentialsOnExit).toBe(false);
      expect(settings.enableAuditLog).toBe(false);
    });
  });

  describe('ApplicationConfiguration', () => {
    it('should create a complete application configuration', () => {
      const config: ApplicationConfiguration = {
        app: DEFAULT_CONFIG.app,
        providers: DEFAULT_CONFIG.providers,
        memory: DEFAULT_CONFIG.memory,
        ui: DEFAULT_CONFIG.ui,
        export: DEFAULT_CONFIG.export,
        security: DEFAULT_CONFIG.security,
        lastModified: new Date('2024-01-01T00:00:00.000Z'),
        configVersion: '1.0.0',
      };

      expect(config.app).toEqual(DEFAULT_CONFIG.app);
      expect(config.providers).toEqual(DEFAULT_CONFIG.providers);
      expect(config.memory).toEqual(DEFAULT_CONFIG.memory);
      expect(config.ui).toEqual(DEFAULT_CONFIG.ui);
      expect(config.export).toEqual(DEFAULT_CONFIG.export);
      expect(config.security).toEqual(DEFAULT_CONFIG.security);
      expect(config.lastModified).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(config.configVersion).toBe('1.0.0');
    });
  });

  describe('ConfigValidationResult', () => {
    it('should create a valid validation result', () => {
      const result: ConfigValidationResult = {
        isValid: true,
        errors: [],
        migrationsNeeded: [],
      };

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.migrationsNeeded).toHaveLength(0);
    });

    it('should create an invalid validation result with errors', () => {
      const result: ConfigValidationResult = {
        isValid: false,
        errors: [
          {
            path: 'app.maxConversationHistory',
            message: 'Must be a positive number',
            severity: 'error',
          },
          {
            path: 'memory.semanticSearchThreshold',
            message: 'Should be between 0 and 1',
            severity: 'warning',
          },
        ],
        migrationsNeeded: ['1.0.0-to-1.1.0'],
      };

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].path).toBe('app.maxConversationHistory');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[1].severity).toBe('warning');
      expect(result.migrationsNeeded).toEqual(['1.0.0-to-1.1.0']);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_CONFIG.app.version).toBe('1.0.0');
      expect(DEFAULT_CONFIG.app.theme).toBe('system');
      expect(DEFAULT_CONFIG.app.language).toBe('en');
      expect(DEFAULT_CONFIG.app.autoSave).toBe(true);
      expect(DEFAULT_CONFIG.app.windowSettings.width).toBe(1200);
      expect(DEFAULT_CONFIG.app.windowSettings.height).toBe(800);
      
      expect(DEFAULT_CONFIG.providers.defaultTimeout).toBe(30000);
      expect(DEFAULT_CONFIG.providers.maxRetries).toBe(3);
      
      expect(DEFAULT_CONFIG.memory.enableSharedMemory).toBe(true);
      expect(DEFAULT_CONFIG.memory.embeddingModel).toBe('all-MiniLM-L6-v2');
      
      expect(DEFAULT_CONFIG.ui.fontSize).toBe('medium');
      expect(DEFAULT_CONFIG.ui.enableMarkdown).toBe(true);
      
      expect(DEFAULT_CONFIG.export.defaultFormat).toBe('markdown');
      expect(DEFAULT_CONFIG.security.encryptLocalData).toBe(true);
      
      expect(DEFAULT_CONFIG.configVersion).toBe('1.0.0');
    });

    it('should have consistent structure', () => {
      expect(typeof DEFAULT_CONFIG.app).toBe('object');
      expect(typeof DEFAULT_CONFIG.providers).toBe('object');
      expect(typeof DEFAULT_CONFIG.memory).toBe('object');
      expect(typeof DEFAULT_CONFIG.ui).toBe('object');
      expect(typeof DEFAULT_CONFIG.export).toBe('object');
      expect(typeof DEFAULT_CONFIG.security).toBe('object');
      expect(DEFAULT_CONFIG.lastModified).toBeInstanceOf(Date);
    });
  });
});