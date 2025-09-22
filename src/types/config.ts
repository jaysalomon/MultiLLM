/**
 * Application configuration interfaces
 * Requirements: 4.4, 4.5
 */

/**
 * Application settings
 * Requirements: 4.4
 */
export interface AppConfig {
  version: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  autoSaveInterval: number; // in minutes
  maxConversationHistory: number; // maximum messages to keep in memory
  enableNotifications: boolean;
  enableSounds: boolean;
  windowSettings: WindowSettings;
  developerMode: boolean;
}

/**
 * Window settings for the application
 * Requirements: 4.4
 */
export interface WindowSettings {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
  alwaysOnTop: boolean;
}

/**
 * Provider management settings
 * Requirements: 4.1, 4.5
 */
export interface ProviderSettings {
  defaultTimeout: number; // in milliseconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
  enableHealthChecks: boolean;
  healthCheckInterval: number; // in minutes
  maxConcurrentRequests: number;
}

/**
 * Memory system settings
 * Requirements: 8.1, 8.5
 */
export interface MemorySettings {
  enableSharedMemory: boolean;
  maxFactsPerConversation: number;
  maxSummariesPerConversation: number;
  autoSummarizeThreshold: number; // number of messages before auto-summarization
  embeddingModel: string; // local embedding model to use
  semanticSearchThreshold: number; // minimum similarity score for search results
  memoryRetentionDays: number; // how long to keep memory data
}

/**
 * UI/UX settings
 * Requirements: 4.4
 */
export interface UISettings {
  messageAnimations: boolean;
  showTimestamps: boolean;
  showTokenCounts: boolean;
  showProcessingTimes: boolean;
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  messageGrouping: boolean; // group consecutive messages from same sender
  enableMarkdown: boolean;
  enableCodeHighlighting: boolean;
}

/**
 * Export/Import settings
 * Requirements: 9.2, 9.3
 */
export interface ExportSettings {
  defaultFormat: 'json' | 'markdown' | 'txt';
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeSharedMemory: boolean;
  compressExports: boolean;
}

/**
 * Security settings
 * Requirements: 4.1, 4.5
 */
export interface SecuritySettings {
  encryptLocalData: boolean;
  requireAuthForSensitiveActions: boolean;
  sessionTimeout: number; // in minutes, 0 for no timeout
  clearCredentialsOnExit: boolean;
  enableAuditLog: boolean;
}

/**
 * Complete application configuration
 * Requirements: 4.4, 4.5
 */
export interface ApplicationConfiguration {
  app: AppConfig;
  providers: ProviderSettings;
  memory: MemorySettings;
  ui: UISettings;
  export: ExportSettings;
  security: SecuritySettings;
  lastModified: Date;
  configVersion: string;
}

/**
 * Configuration validation result
 * Requirements: 4.5
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  migrationsNeeded: string[];
}

/**
 * Default configuration values
 * Requirements: 4.4
 */
export const DEFAULT_CONFIG: ApplicationConfiguration = {
  app: {
    version: '1.0.0',
    theme: 'system',
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
  },
  providers: {
    defaultTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    enableHealthChecks: true,
    healthCheckInterval: 5,
    maxConcurrentRequests: 5,
  },
  memory: {
    enableSharedMemory: true,
    maxFactsPerConversation: 500,
    maxSummariesPerConversation: 50,
    autoSummarizeThreshold: 100,
    embeddingModel: 'all-MiniLM-L6-v2',
    semanticSearchThreshold: 0.7,
    memoryRetentionDays: 30,
  },
  ui: {
    messageAnimations: true,
    showTimestamps: true,
    showTokenCounts: false,
    showProcessingTimes: false,
    compactMode: false,
    fontSize: 'medium',
    messageGrouping: true,
    enableMarkdown: true,
    enableCodeHighlighting: true,
  },
  export: {
    defaultFormat: 'markdown',
    includeMetadata: true,
    includeTimestamps: true,
    includeSharedMemory: false,
    compressExports: false,
  },
  security: {
    encryptLocalData: true,
    requireAuthForSensitiveActions: false,
    sessionTimeout: 0,
    clearCredentialsOnExit: false,
    enableAuditLog: false,
  },
  lastModified: new Date(),
  configVersion: '1.0.0',
};