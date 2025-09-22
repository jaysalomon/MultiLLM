/**
 * Performance monitoring and alerting system
 * Tracks application performance metrics and provides alerts
 * Requirements: 2.4, 4.5
 */

import { log } from './Logger';
import { errorReporter } from './ErrorReporter';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: string;
  tags?: Record<string, string>;
}

export interface PerformanceThreshold {
  name: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface CPUUsage {
  percentage: number;
  loadAverage?: number[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private timers: Map<string, number> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isEnabled = true;
  
  private readonly maxMetrics = 10000;
  private readonly maxAlerts = 1000;
  
  // Default performance thresholds
  private thresholds: PerformanceThreshold[] = [
    { name: 'response_time', warning: 1000, critical: 3000, unit: 'ms' },
    { name: 'memory_usage', warning: 80, critical: 95, unit: '%' },
    { name: 'cpu_usage', warning: 80, critical: 95, unit: '%' },
    { name: 'database_query', warning: 500, critical: 2000, unit: 'ms' },
    { name: 'llm_request', warning: 5000, critical: 15000, unit: 'ms' },
    { name: 'ui_render', warning: 16, critical: 50, unit: 'ms' },
    { name: 'file_operation', warning: 1000, critical: 5000, unit: 'ms' }
  ];

  constructor() {
    this.startSystemMonitoring();
  }

  /**
   * Start monitoring system resources
   */
  private startSystemMonitoring(): void {
    if (!this.isEnabled) return;

    // Monitor memory usage every 30 seconds
    const memoryInterval = setInterval(() => {
      this.recordMemoryUsage();
    }, 30000);
    this.intervals.set('memory', memoryInterval);

    // Monitor performance marks every 10 seconds
    const performanceInterval = setInterval(() => {
      this.recordPerformanceMarks();
    }, 10000);
    this.intervals.set('performance', performanceInterval);
  }

  /**
   * Record memory usage metrics
   */
  private recordMemoryUsage(): void {
    try {
      let memoryUsage: MemoryUsage | null = null;

      if (typeof process !== 'undefined' && process.memoryUsage) {
        // Node.js environment (main process)
        const usage = process.memoryUsage();
        memoryUsage = {
          used: usage.heapUsed,
          total: usage.heapTotal,
          percentage: (usage.heapUsed / usage.heapTotal) * 100
        };
      } else if (typeof window !== 'undefined' && 'memory' in performance) {
        // Browser environment with memory API
        const memory = (performance as any).memory;
        memoryUsage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        };
      }

      if (memoryUsage) {
        this.recordMetric({
          name: 'memory_usage',
          value: memoryUsage.percentage,
          unit: '%',
          category: 'system',
          tags: {
            used: `${Math.round(memoryUsage.used / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.total / 1024 / 1024)}MB`
          }
        });

        // Check for memory threshold violations
        this.checkThreshold('memory_usage', memoryUsage.percentage);
      }
    } catch (error) {
      log.error('Failed to record memory usage', { error });
    }
  }

  /**
   * Record performance marks and measures
   */
  private recordPerformanceMarks(): void {
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const measures = performance.getEntriesByType('measure');
        
        measures.forEach((measure) => {
          this.recordMetric({
            name: measure.name,
            value: measure.duration,
            unit: 'ms',
            category: 'performance',
            tags: {
              type: 'measure'
            }
          });
        });

        // Clear old performance entries
        if (performance.clearMeasures) {
          performance.clearMeasures();
        }
      }
    } catch (error) {
      log.error('Failed to record performance marks', { error });
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date()
    };

    this.metrics.push(fullMetric);

    // Keep metrics manageable
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log significant metrics
    if (metric.category === 'system' || metric.value > 1000) {
      log.performance.info(`Performance metric: ${metric.name}`, {
        value: metric.value,
        unit: metric.unit,
        category: metric.category,
        tags: metric.tags
      });
    }

    // Check thresholds
    this.checkThreshold(metric.name, metric.value);
  }

  /**
   * Check if a metric violates performance thresholds
   */
  private checkThreshold(metricName: string, value: number): void {
    const threshold = this.thresholds.find(t => t.name === metricName);
    if (!threshold) return;

    let severity: 'warning' | 'critical' | null = null;
    let thresholdValue = 0;

    if (value >= threshold.critical) {
      severity = 'critical';
      thresholdValue = threshold.critical;
    } else if (value >= threshold.warning) {
      severity = 'warning';
      thresholdValue = threshold.warning;
    }

    if (severity) {
      this.createAlert(metricName, value, thresholdValue, severity);
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(metric: string, value: number, threshold: number, severity: 'warning' | 'critical'): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      metric,
      value,
      threshold,
      severity,
      message: `Performance ${severity}: ${metric} is ${value} (threshold: ${threshold})`
    };

    this.alerts.push(alert);

    // Keep alerts manageable
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Log the alert
    if (severity === 'critical') {
      log.error(alert.message, { alert });
      
      // Report critical performance issues as errors
      errorReporter.reportPerformanceIssue(alert.message, { value, threshold }, {
        component: 'PerformanceMonitor',
        action: 'threshold_violation',
        additionalData: { metric, severity }
      });
    } else {
      log.warn(alert.message, { alert });
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    if (!this.isEnabled) return;
    
    this.timers.set(name, Date.now());
    
    // Use performance API if available
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * End timing an operation and record the metric
   */
  endTimer(name: string, category = 'timing', tags?: Record<string, string>): number {
    if (!this.isEnabled) return 0;

    const startTime = this.timers.get(name);
    if (!startTime) {
      log.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    // Use performance API if available
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }

    // Record the metric
    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      category,
      tags
    });

    return duration;
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(name: string, operation: () => Promise<T>, category = 'async', tags?: Record<string, string>): Promise<T> {
    this.startTimer(name);
    try {
      const result = await operation();
      this.endTimer(name, category, tags);
      return result;
    } catch (error) {
      this.endTimer(name, category, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Time a synchronous operation
   */
  timeSync<T>(name: string, operation: () => T, category = 'sync', tags?: Record<string, string>): T {
    this.startTimer(name);
    try {
      const result = operation();
      this.endTimer(name, category, tags);
      return result;
    } catch (error) {
      this.endTimer(name, category, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Record LLM request performance
   */
  recordLLMRequest(provider: string, model: string, duration: number, tokenCount?: number): void {
    this.recordMetric({
      name: 'llm_request',
      value: duration,
      unit: 'ms',
      category: 'llm',
      tags: {
        provider,
        model,
        tokens: tokenCount?.toString() || 'unknown'
      }
    });
  }

  /**
   * Record database operation performance
   */
  recordDatabaseOperation(operation: string, table: string, duration: number): void {
    this.recordMetric({
      name: 'database_query',
      value: duration,
      unit: 'ms',
      category: 'database',
      tags: {
        operation,
        table
      }
    });
  }

  /**
   * Record UI render performance
   */
  recordUIRender(component: string, duration: number): void {
    this.recordMetric({
      name: 'ui_render',
      value: duration,
      unit: 'ms',
      category: 'ui',
      tags: {
        component
      }
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics(category?: string, limit = 1000): PerformanceMetric[] {
    let filtered = this.metrics;
    
    if (category) {
      filtered = filtered.filter(m => m.category === category);
    }
    
    return filtered.slice(-limit);
  }

  /**
   * Get performance alerts
   */
  getAlerts(severity?: 'warning' | 'critical', limit = 100): PerformanceAlert[] {
    let filtered = this.alerts;
    
    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }
    
    return filtered.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalMetrics: number;
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    averageResponseTime: number;
    memoryUsage?: number;
  } {
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = this.alerts.filter(a => a.severity === 'warning').length;
    
    const responseTimeMetrics = this.metrics.filter(m => m.name === 'response_time');
    const averageResponseTime = responseTimeMetrics.length > 0
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
      : 0;
    
    const memoryMetrics = this.metrics.filter(m => m.name === 'memory_usage');
    const currentMemoryUsage = memoryMetrics.length > 0 
      ? memoryMetrics[memoryMetrics.length - 1].value 
      : undefined;

    return {
      totalMetrics: this.metrics.length,
      totalAlerts: this.alerts.length,
      criticalAlerts,
      warningAlerts,
      averageResponseTime,
      memoryUsage: currentMemoryUsage
    };
  }

  /**
   * Clear old metrics and alerts
   */
  cleanup(olderThanHours = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    
    log.info('Performance monitor cleanup completed', {
      metricsRemaining: this.metrics.length,
      alertsRemaining: this.alerts.length
    });
  }

  /**
   * Set custom performance threshold
   */
  setThreshold(threshold: PerformanceThreshold): void {
    const index = this.thresholds.findIndex(t => t.name === threshold.name);
    if (index >= 0) {
      this.thresholds[index] = threshold;
    } else {
      this.thresholds.push(threshold);
    }
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      // Clear intervals
      this.intervals.forEach(interval => clearInterval(interval));
      this.intervals.clear();
    } else {
      // Restart monitoring
      this.startSystemMonitoring();
    }
  }

  /**
   * Stop all monitoring
   */
  stop(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.timers.clear();
    this.isEnabled = false;
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export const startTimer = (name: string) => performanceMonitor.startTimer(name);
export const endTimer = (name: string, category?: string, tags?: Record<string, string>) => 
  performanceMonitor.endTimer(name, category, tags);
export const timeAsync = <T>(name: string, operation: () => Promise<T>, category?: string, tags?: Record<string, string>) =>
  performanceMonitor.timeAsync(name, operation, category, tags);
export const timeSync = <T>(name: string, operation: () => T, category?: string, tags?: Record<string, string>) =>
  performanceMonitor.timeSync(name, operation, category, tags);

export default performanceMonitor;