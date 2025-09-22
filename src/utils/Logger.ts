/**
 * Comprehensive logging system for Multi-LLM Chat application
 * Provides structured logging with different levels and contexts
 * Requirements: 2.4, 4.5
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  stack?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  maxFileSize: number;
  maxFiles: number;
  remoteEndpoint?: string;
}

export class Logger {
  private config: LoggerConfig;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      enableRemote: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...config
    };
    
    this.sessionId = this.generateSessionId();
    this.setupErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupErrorHandlers(): void {
    // Global error handler for unhandled errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('Unhandled Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection', {
          reason: event.reason,
          promise: event.promise
        });
      });
    }

    // Node.js error handlers for main process
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        this.critical('Uncaught Exception', { error });
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.error('Unhandled Promise Rejection', { reason, promise });
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const context = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
    const error = entry.error ? ` | Error: ${entry.error.message}` : '';
    
    return `[${timestamp}] [${level}] [${entry.category}] ${entry.message}${context}${error}`;
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.config.enableFile) return;

    try {
      // In Electron, we can use Node.js fs module
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.writeLog(entry);
      }
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.error('Failed to send log to remote endpoint:', error);
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  private async log(level: LogLevel, category: string, message: string, context?: Record<string, any>, error?: Error): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      context,
      error,
      stack: error?.stack,
      sessionId: this.sessionId
    };

    this.addToBuffer(entry);

    // Console logging
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(entry);
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          console.error(formattedMessage);
          if (error) console.error(error);
          break;
      }
    }

    // File logging
    await this.writeToFile(entry);

    // Remote logging
    await this.sendToRemote(entry);
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context, error);
  }

  critical(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.CRITICAL, 'CRITICAL', message, context, error);
  }

  // Category-specific logging methods
  provider(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    this.log(level, 'PROVIDER', message, context, error);
  }

  database(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    this.log(level, 'DATABASE', message, context, error);
  }

  ui(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    this.log(level, 'UI', message, context, error);
  }

  performance(level: LogLevel, message: string, context?: Record<string, any>): void {
    this.log(level, 'PERFORMANCE', message, context);
  }

  security(level: LogLevel, message: string, context?: Record<string, any>): void {
    this.log(level, 'SECURITY', message, context);
  }

  // Utility methods
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // Performance timing utilities
  time(label: string): void {
    if (typeof console.time === 'function') {
      console.time(label);
    }
    this.debug(`Timer started: ${label}`);
  }

  timeEnd(label: string): void {
    if (typeof console.timeEnd === 'function') {
      console.timeEnd(label);
    }
    this.debug(`Timer ended: ${label}`);
  }

  // Memory usage logging
  logMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.performance(LogLevel.INFO, 'Memory Usage', {
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`
      });
    }
  }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, context?: Record<string, any>) => logger.debug(message, context),
  info: (message: string, context?: Record<string, any>) => logger.info(message, context),
  warn: (message: string, context?: Record<string, any>) => logger.warn(message, context),
  error: (message: string, context?: Record<string, any>, error?: Error) => logger.error(message, context, error),
  critical: (message: string, context?: Record<string, any>, error?: Error) => logger.critical(message, context, error),
  
  provider: {
    debug: (message: string, context?: Record<string, any>) => logger.provider(LogLevel.DEBUG, message, context),
    info: (message: string, context?: Record<string, any>) => logger.provider(LogLevel.INFO, message, context),
    warn: (message: string, context?: Record<string, any>) => logger.provider(LogLevel.WARN, message, context),
    error: (message: string, context?: Record<string, any>, error?: Error) => logger.provider(LogLevel.ERROR, message, context, error),
  },
  
  database: {
    debug: (message: string, context?: Record<string, any>) => logger.database(LogLevel.DEBUG, message, context),
    info: (message: string, context?: Record<string, any>) => logger.database(LogLevel.INFO, message, context),
    warn: (message: string, context?: Record<string, any>) => logger.database(LogLevel.WARN, message, context),
    error: (message: string, context?: Record<string, any>, error?: Error) => logger.database(LogLevel.ERROR, message, context, error),
  },
  
  ui: {
    debug: (message: string, context?: Record<string, any>) => logger.ui(LogLevel.DEBUG, message, context),
    info: (message: string, context?: Record<string, any>) => logger.ui(LogLevel.INFO, message, context),
    warn: (message: string, context?: Record<string, any>) => logger.ui(LogLevel.WARN, message, context),
    error: (message: string, context?: Record<string, any>, error?: Error) => logger.ui(LogLevel.ERROR, message, context, error),
  },
  
  performance: {
    info: (message: string, context?: Record<string, any>) => logger.performance(LogLevel.INFO, message, context),
    warn: (message: string, context?: Record<string, any>) => logger.performance(LogLevel.WARN, message, context),
  },
  
  security: {
    info: (message: string, context?: Record<string, any>) => logger.security(LogLevel.INFO, message, context),
    warn: (message: string, context?: Record<string, any>) => logger.security(LogLevel.WARN, message, context),
    error: (message: string, context?: Record<string, any>, error?: Error) => logger.security(LogLevel.ERROR, message, { ...context, error: error?.message }),
  }
};

export default logger;