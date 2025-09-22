/**
 * Centralized error and logging system initialization
 * Coordinates all error handling, logging, and monitoring systems
 * Requirements: 2.4, 4.5
 */

import { logger, LogLevel } from './Logger';
import { errorReporter } from './ErrorReporter';
import { performanceMonitor } from './PerformanceMonitor';
import { gracefulDegradation } from './GracefulDegradation';

export interface ErrorLoggingConfig {
  logLevel: LogLevel;
  enableConsoleLogging: boolean;
  enableFileLogging: boolean;
  enableRemoteLogging: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  enableGracefulDegradation: boolean;
  remoteEndpoint?: string;
  errorReportingEndpoint?: string;
  developmentMode?: boolean;
}

class ErrorLoggingSystem {
  private isInitialized = false;
  private config: ErrorLoggingConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Get default configuration based on environment
   */
  private getDefaultConfig(): ErrorLoggingConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
      logLevel: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsoleLogging: true,
      enableFileLogging: true,
      enableRemoteLogging: false, // Disabled by default for privacy
      enableErrorReporting: !isDevelopment, // Only in production
      enablePerformanceMonitoring: true,
      enableGracefulDegradation: true,
      developmentMode: isDevelopment
    };
  }

  /**
   * Initialize the error and logging system
   */
  async initialize(config?: Partial<ErrorLoggingConfig>): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Error logging system already initialized');
      return;
    }

    // Merge configuration
    this.config = { ...this.config, ...config };

    try {
      // Initialize logger
      logger.setLogLevel(this.config.logLevel);
      
      // Configure error reporter
      if (this.config.enableErrorReporting) {
        errorReporter.setEnabled(true);
        if (this.config.errorReportingEndpoint) {
          errorReporter.setReportingEndpoint(this.config.errorReportingEndpoint);
        }
      } else {
        errorReporter.setEnabled(false);
      }

      // Configure performance monitor
      if (!this.config.enablePerformanceMonitoring) {
        performanceMonitor.setEnabled(false);
      }

      // Configure graceful degradation
      if (this.config.enableGracefulDegradation) {
        this.setupGracefulDegradationCallbacks();
      }

      // Setup global error handlers
      this.setupGlobalErrorHandlers();

      // Setup unload handlers
      this.setupUnloadHandlers();

      this.isInitialized = true;

      logger.info('Error logging system initialized successfully', {
        config: this.config,
        timestamp: new Date().toISOString()
      });

      // Log system information
      this.logSystemInformation();

    } catch (error) {
      console.error('Failed to initialize error logging system:', error);
      throw error;
    }
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught errors in renderer process
    if (typeof window !== 'undefined') {
      // Global error handler
      window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message);
        
        logger.critical('Uncaught Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: error.stack
        }, error);

        errorReporter.reportError(error, {
          component: 'GlobalErrorHandler',
          action: 'uncaught_error',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });

        gracefulDegradation.recordFailure('ui', error);
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason));

        logger.critical('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: error.stack
        }, error);

        errorReporter.reportError(error, {
          component: 'GlobalErrorHandler',
          action: 'unhandled_rejection',
          additionalData: {
            reason: String(event.reason)
          }
        });

        gracefulDegradation.recordFailure('ui', error);
      });

      // Handle resource loading errors
      window.addEventListener('error', (event) => {
        if (event.target && event.target !== window) {
          const target = event.target as HTMLElement;
          const resourceError = new Error(`Resource loading failed: ${target.tagName}`);
          
          logger.error('Resource Loading Error', {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            type: event.type
          }, resourceError);

          // Don't report every resource error, but track them
          gracefulDegradation.recordFailure('ui', resourceError);
        }
      }, true);
    }

    // Handle uncaught errors in main process
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        logger.critical('Uncaught Exception in Main Process', {
          stack: error.stack,
          name: error.name,
          message: error.message
        }, error);

        errorReporter.reportError(error, {
          component: 'MainProcess',
          action: 'uncaught_exception'
        });

        gracefulDegradation.recordFailure('database', error);
      });

      process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error 
          ? reason 
          : new Error(String(reason));

        logger.critical('Unhandled Promise Rejection in Main Process', {
          reason: String(reason),
          promise: promise.toString(),
          stack: error.stack
        }, error);

        errorReporter.reportError(error, {
          component: 'MainProcess',
          action: 'unhandled_rejection',
          additionalData: {
            reason: String(reason)
          }
        });

        gracefulDegradation.recordFailure('database', error);
      });
    }
  }

  /**
   * Setup graceful degradation callbacks
   */
  private setupGracefulDegradationCallbacks(): void {
    gracefulDegradation.onDegradationChange('error-logging-system', (level) => {
      logger.warn(`System degradation level changed to: ${level}`, {
        level,
        timestamp: new Date().toISOString()
      });

      // Adjust logging behavior based on degradation level
      if (level === 'critical' || level === 'severe') {
        // Reduce logging verbosity in critical situations
        logger.setLogLevel(LogLevel.ERROR);
        performanceMonitor.setEnabled(false);
      } else if (level === 'moderate') {
        logger.setLogLevel(LogLevel.WARN);
      } else if (level === 'none') {
        // Restore normal logging
        logger.setLogLevel(this.config.logLevel);
        if (this.config.enablePerformanceMonitoring) {
          performanceMonitor.setEnabled(true);
        }
      }
    });
  }

  /**
   * Setup cleanup handlers for application shutdown
   */
  private setupUnloadHandlers(): void {
    const cleanup = () => {
      logger.info('Application shutting down, performing cleanup');
      
      // Stop monitoring systems
      performanceMonitor.stop();
      gracefulDegradation.stop();
      
      // Log final statistics
      const summary = performanceMonitor.getPerformanceSummary();
      logger.info('Final performance summary', summary);
      
      // Clear sensitive data
      errorReporter.clearBreadcrumbs();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('unload', cleanup);
    }

    if (typeof process !== 'undefined') {
      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }
  }

  /**
   * Log system information for debugging
   */
  private logSystemInformation(): void {
    const systemInfo: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: typeof window !== 'undefined' ? 'renderer' : 'main'
    };

    if (typeof window !== 'undefined') {
      systemInfo.userAgent = navigator.userAgent;
      systemInfo.language = navigator.language;
      systemInfo.screen = {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      };
      
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        systemInfo.memory = {
          used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
          total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`
        };
      }
    }

    if (typeof process !== 'undefined') {
      systemInfo.nodeVersion = process.version;
      systemInfo.platform = `${process.platform}-${process.arch}`;
      systemInfo.pid = process.pid;
      
      const usage = process.memoryUsage();
      systemInfo.memory = {
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
      };
    }

    logger.info('System information', systemInfo);
  }

  /**
   * Create a scoped logger for a specific component
   */
  createComponentLogger(component: string) {
    return {
      debug: (message: string, context?: Record<string, any>) => 
        logger.debug(`[${component}] ${message}`, context),
      info: (message: string, context?: Record<string, any>) => 
        logger.info(`[${component}] ${message}`, context),
      warn: (message: string, context?: Record<string, any>) => 
        logger.warn(`[${component}] ${message}`, context),
      error: (message: string, context?: Record<string, any>, error?: Error) => 
        logger.error(`[${component}] ${message}`, context, error),
      critical: (message: string, context?: Record<string, any>, error?: Error) => 
        logger.critical(`[${component}] ${message}`, context, error),
      
      // Component-specific error reporting
      reportError: (error: Error, action: string, additionalData?: Record<string, any>) =>
        errorReporter.reportHandledError(error, component, action, additionalData),
      
      // Component-specific failure recording
      recordFailure: (error?: Error) => 
        gracefulDegradation.recordFailure(component, error),
      
      // Performance timing
      startTimer: (name: string) => 
        performanceMonitor.startTimer(`${component}.${name}`),
      endTimer: (name: string) => 
        performanceMonitor.endTimer(`${component}.${name}`, 'component', { component }),
      timeAsync: <T>(name: string, operation: () => Promise<T>) =>
        performanceMonitor.timeAsync(`${component}.${name}`, operation, 'component', { component })
    };
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      config: this.config,
      systemHealth: gracefulDegradation.getSystemHealth(),
      degradationLevel: gracefulDegradation.getCurrentLevel(),
      performanceSummary: performanceMonitor.getPerformanceSummary(),
      recentAlerts: performanceMonitor.getAlerts('critical', 10),
      logBuffer: logger.getLogBuffer().slice(-50) // Last 50 log entries
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorLoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Apply configuration changes
    logger.setLogLevel(this.config.logLevel);
    errorReporter.setEnabled(this.config.enableErrorReporting);
    performanceMonitor.setEnabled(this.config.enablePerformanceMonitoring);
    
    logger.info('Error logging system configuration updated', { config: this.config });
  }

  /**
   * Shutdown the error logging system
   */
  shutdown(): void {
    if (!this.isInitialized) return;

    logger.info('Shutting down error logging system');
    
    performanceMonitor.stop();
    gracefulDegradation.stop();
    
    this.isInitialized = false;
  }
}

// Create singleton instance
export const errorLoggingSystem = new ErrorLoggingSystem();

// Export convenience function for initialization
export const initializeErrorLogging = (config?: Partial<ErrorLoggingConfig>) =>
  errorLoggingSystem.initialize(config);

export default errorLoggingSystem;