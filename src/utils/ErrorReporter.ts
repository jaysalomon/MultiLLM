/**
 * Error reporting system for production issues
 * Collects and reports errors with context for debugging
 * Requirements: 2.4, 4.5
 */

import { logger, LogEntry, LogLevel } from './Logger';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: Error;
  context: ErrorContext;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  tags: string[];
  breadcrumbs: Breadcrumb[];
  systemInfo: SystemInfo;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  props?: Record<string, any>;
  state?: Record<string, any>;
  additionalData?: Record<string, any>;
}

export interface Breadcrumb {
  timestamp: Date;
  category: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface SystemInfo {
  platform: string;
  userAgent?: string;
  version: string;
  memory?: {
    used: number;
    total: number;
  };
  screen?: {
    width: number;
    height: number;
  };
}

class ErrorReporter {
  private breadcrumbs: Breadcrumb[] = [];
  private readonly maxBreadcrumbs = 50;
  private isEnabled = true;
  private reportingEndpoint?: string;

  constructor(config?: { endpoint?: string; enabled?: boolean }) {
    this.reportingEndpoint = config?.endpoint;
    this.isEnabled = config?.enabled ?? true;
  }

  /**
   * Add a breadcrumb for tracking user actions leading to errors
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    if (!this.isEnabled) return;

    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date()
    });

    // Keep breadcrumbs manageable
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Get system information for error reports
   */
  private getSystemInfo(): SystemInfo {
    const systemInfo: SystemInfo = {
      platform: typeof window !== 'undefined' ? 'renderer' : 'main',
      version: '1.0.0', // Should be read from package.json
    };

    if (typeof window !== 'undefined') {
      systemInfo.userAgent = navigator.userAgent;
      systemInfo.screen = {
        width: screen.width,
        height: screen.height
      };

      // Memory info if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        systemInfo.memory = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize
        };
      }
    }

    if (typeof process !== 'undefined') {
      systemInfo.platform = `${process.platform}-${process.arch}`;
      
      if (process.memoryUsage) {
        const usage = process.memoryUsage();
        systemInfo.memory = {
          used: usage.heapUsed,
          total: usage.heapTotal
        };
      }
    }

    return systemInfo;
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors that could crash the app
    if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
      return 'critical';
    }

    if (error.name === 'ReferenceError') {
      return 'critical';
    }

    // High severity for provider or database errors
    if (context.component?.includes('Provider') || context.component?.includes('Database')) {
      return 'high';
    }

    // Medium severity for UI component errors
    if (context.component?.includes('Component') || context.component?.includes('UI')) {
      return 'medium';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Categorize error based on context and error type
   */
  private categorizeError(error: Error, context: ErrorContext): string {
    if (context.component?.includes('Provider')) return 'provider';
    if (context.component?.includes('Database')) return 'database';
    if (context.component?.includes('UI') || context.component?.includes('Component')) return 'ui';
    if (context.component?.includes('Memory')) return 'memory';
    if (context.component?.includes('Performance')) return 'performance';
    
    // Categorize by error type
    if (error.name === 'NetworkError' || error.message.includes('fetch')) return 'network';
    if (error.name === 'TypeError') return 'type';
    if (error.name === 'ReferenceError') return 'reference';
    
    return 'general';
  }

  /**
   * Generate tags for error filtering and searching
   */
  private generateTags(error: Error, context: ErrorContext): string[] {
    const tags: string[] = [];
    
    // Add component tags
    if (context.component) {
      tags.push(`component:${context.component.toLowerCase()}`);
    }
    
    // Add action tags
    if (context.action) {
      tags.push(`action:${context.action.toLowerCase()}`);
    }
    
    // Add error type tags
    tags.push(`error:${error.name.toLowerCase()}`);
    
    // Add platform tags
    if (typeof window !== 'undefined') {
      tags.push('platform:renderer');
    } else {
      tags.push('platform:main');
    }
    
    return tags;
  }

  /**
   * Create a comprehensive error report
   */
  private createErrorReport(error: Error, context: ErrorContext = {}): ErrorReport {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const severity = this.determineSeverity(error, context);
    const category = this.categorizeError(error, context);
    const tags = this.generateTags(error, context);
    const systemInfo = this.getSystemInfo();

    return {
      id,
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as Error,
      context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      sessionId: logger.getSessionId(),
      severity,
      category,
      tags,
      breadcrumbs: [...this.breadcrumbs],
      systemInfo
    };
  }

  /**
   * Send error report to remote endpoint
   */
  private async sendToRemote(report: ErrorReport): Promise<void> {
    if (!this.reportingEndpoint) return;

    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
      });
    } catch (error) {
      logger.error('Failed to send error report to remote endpoint', { error });
    }
  }

  /**
   * Store error report locally for offline scenarios
   */
  private async storeLocally(report: ErrorReport): Promise<void> {
    try {
      // In Electron, we can use the main process to store errors
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.storeErrorReport(report);
      } else {
        // Fallback to localStorage in renderer process
        const stored = localStorage.getItem('errorReports') || '[]';
        const reports = JSON.parse(stored);
        reports.push(report);
        
        // Keep only last 100 reports
        if (reports.length > 100) {
          reports.splice(0, reports.length - 100);
        }
        
        localStorage.setItem('errorReports', JSON.stringify(reports));
      }
    } catch (error) {
      logger.error('Failed to store error report locally', { error });
    }
  }

  /**
   * Report an error with context
   */
  async reportError(error: Error, context: ErrorContext = {}): Promise<void> {
    if (!this.isEnabled) return;

    const report = this.createErrorReport(error, context);

    // Log the error
    logger.error(`Error reported: ${error.message}`, {
      errorId: report.id,
      category: report.category,
      severity: report.severity,
      context: report.context
    }, error);

    // Store locally first (always works)
    await this.storeLocally(report);

    // Try to send to remote endpoint
    await this.sendToRemote(report);

    // Add breadcrumb for this error
    this.addBreadcrumb({
      category: 'error',
      message: `Error reported: ${error.message}`,
      level: 'error',
      data: {
        errorId: report.id,
        category: report.category,
        severity: report.severity
      }
    });
  }

  /**
   * Report a handled error with additional context
   */
  async reportHandledError(
    error: Error, 
    component: string, 
    action: string, 
    additionalData?: Record<string, any>
  ): Promise<void> {
    await this.reportError(error, {
      component,
      action,
      additionalData
    });
  }

  /**
   * Report a performance issue
   */
  async reportPerformanceIssue(
    message: string, 
    metrics: Record<string, number>, 
    context?: ErrorContext
  ): Promise<void> {
    const error = new Error(message);
    error.name = 'PerformanceError';
    
    await this.reportError(error, {
      ...context,
      additionalData: {
        ...context?.additionalData,
        metrics
      }
    });
  }

  /**
   * Get stored error reports for debugging
   */
  async getStoredReports(): Promise<ErrorReport[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getStoredErrorReports();
      } else {
        const stored = localStorage.getItem('errorReports') || '[]';
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.error('Failed to retrieve stored error reports', { error });
      return [];
    }
  }

  /**
   * Clear stored error reports
   */
  async clearStoredReports(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.clearStoredErrorReports();
      } else {
        localStorage.removeItem('errorReports');
      }
    } catch (error) {
      logger.error('Failed to clear stored error reports', { error });
    }
  }

  /**
   * Enable or disable error reporting
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Set remote reporting endpoint
   */
  setReportingEndpoint(endpoint: string): void {
    this.reportingEndpoint = endpoint;
  }

  /**
   * Get current breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}

// Create singleton instance
export const errorReporter = new ErrorReporter();

// Export convenience functions
export const reportError = (error: Error, context?: ErrorContext) => 
  errorReporter.reportError(error, context);

export const reportHandledError = (error: Error, component: string, action: string, data?: Record<string, any>) =>
  errorReporter.reportHandledError(error, component, action, data);

export const addBreadcrumb = (breadcrumb: Omit<Breadcrumb, 'timestamp'>) =>
  errorReporter.addBreadcrumb(breadcrumb);

export default errorReporter;