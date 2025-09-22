/**
 * Graceful degradation system for critical failures
 * Provides fallback functionality when core systems fail
 * Requirements: 2.4, 4.5
 */

import { log, LogLevel } from './Logger';
import { errorReporter, addBreadcrumb } from './ErrorReporter';
import { performanceMonitor } from './PerformanceMonitor';

export interface DegradationLevel {
  level: 'none' | 'minimal' | 'moderate' | 'severe' | 'critical';
  description: string;
  disabledFeatures: string[];
  fallbackBehaviors: Record<string, any>;
}

export interface SystemHealth {
  database: 'healthy' | 'degraded' | 'failed';
  providers: 'healthy' | 'degraded' | 'failed';
  memory: 'healthy' | 'degraded' | 'failed';
  ui: 'healthy' | 'degraded' | 'failed';
  overall: 'healthy' | 'degraded' | 'failed';
}

export interface FailureThreshold {
  component: string;
  errorCount: number;
  timeWindow: number; // milliseconds
  degradationLevel: DegradationLevel['level'];
}

class GracefulDegradation {
  private currentLevel: DegradationLevel['level'] = 'none';
  private systemHealth: SystemHealth = {
    database: 'healthy',
    providers: 'healthy',
    memory: 'healthy',
    ui: 'healthy',
    overall: 'healthy'
  };
  
  private errorCounts: Map<string, { count: number; firstError: number }> = new Map();
  private degradationCallbacks: Map<string, (level: DegradationLevel['level']) => void> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  
  // Failure thresholds for different components
  private thresholds: FailureThreshold[] = [
    { component: 'database', errorCount: 3, timeWindow: 60000, degradationLevel: 'severe' },
    { component: 'provider', errorCount: 5, timeWindow: 300000, degradationLevel: 'moderate' },
    { component: 'memory', errorCount: 2, timeWindow: 30000, degradationLevel: 'critical' },
    { component: 'ui', errorCount: 10, timeWindow: 60000, degradationLevel: 'minimal' },
  ];

  // Degradation levels configuration
  private degradationLevels: Record<DegradationLevel['level'], DegradationLevel> = {
    none: {
      level: 'none',
      description: 'All systems operational',
      disabledFeatures: [],
      fallbackBehaviors: {}
    },
    minimal: {
      level: 'minimal',
      description: 'Minor features disabled, core functionality available',
      disabledFeatures: ['animations', 'auto-save', 'real-time-updates'],
      fallbackBehaviors: {
        saveInterval: 30000, // Increase save interval
        maxConcurrentRequests: 3,
        enableOfflineMode: true
      }
    },
    moderate: {
      level: 'moderate',
      description: 'Some providers unavailable, limited functionality',
      disabledFeatures: ['multi-provider', 'streaming', 'context-injection', 'performance-analytics'],
      fallbackBehaviors: {
        maxActiveProviders: 1,
        disableStreaming: true,
        simplifiedUI: true,
        reducedMemoryUsage: true
      }
    },
    severe: {
      level: 'severe',
      description: 'Database issues, conversation history may be limited',
      disabledFeatures: ['conversation-history', 'memory-persistence', 'export', 'search'],
      fallbackBehaviors: {
        inMemoryOnly: true,
        maxConversationLength: 50,
        disableComplexFeatures: true,
        emergencyMode: true
      }
    },
    critical: {
      level: 'critical',
      description: 'Critical system failure, basic chat only',
      disabledFeatures: ['all-advanced-features'],
      fallbackBehaviors: {
        basicChatOnly: true,
        singleProvider: true,
        noMemory: true,
        emergencyUI: true
      }
    }
  };

  constructor() {
    this.startHealthMonitoring();
  }

  /**
   * Start monitoring system health
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const newHealth: SystemHealth = {
        database: await this.checkDatabaseHealth(),
        providers: await this.checkProvidersHealth(),
        memory: await this.checkMemoryHealth(),
        ui: await this.checkUIHealth(),
        overall: 'healthy'
      };

      // Determine overall health
      const healthValues = Object.values(newHealth).filter(v => v !== 'healthy');
      if (healthValues.some(v => v === 'failed')) {
        newHealth.overall = 'failed';
      } else if (healthValues.some(v => v === 'degraded')) {
        newHealth.overall = 'degraded';
      }

      // Update system health
      const previousHealth = { ...this.systemHealth };
      this.systemHealth = newHealth;

      // Log health changes
      if (JSON.stringify(previousHealth) !== JSON.stringify(newHealth)) {
        log.info('System health changed', {
          previous: previousHealth,
          current: newHealth
        });

        addBreadcrumb({
          category: 'system',
          message: `System health changed to ${newHealth.overall}`,
          level: newHealth.overall === 'failed' ? 'error' : 'warning',
          data: newHealth
        });
      }

      // Adjust degradation level based on health
      this.adjustDegradationLevel();

    } catch (error) {
      log.error('Health check failed', { error });
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      // In a real implementation, this would test database connectivity
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Test a simple database operation
        await window.electronAPI.healthCheck?.();
        return 'healthy';
      }
      return 'degraded'; // No database API available
    } catch (error) {
      log.database.error('Database health check failed', { error });
      return 'failed';
    }
  }

  /**
   * Check providers health
   */
  private async checkProvidersHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      // This would check if any providers are responding
      const errorCount = this.getErrorCount('provider');
      if (errorCount > 10) return 'failed';
      if (errorCount > 5) return 'degraded';
      return 'healthy';
    } catch (error) {
      log.provider.error('Provider health check failed', { error });
      return 'failed';
    }
  }

  /**
   * Check memory system health
   */
  private async checkMemoryHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      // Check memory usage
      const summary = performanceMonitor.getPerformanceSummary();
      if (summary.memoryUsage && summary.memoryUsage > 95) return 'failed';
      if (summary.memoryUsage && summary.memoryUsage > 85) return 'degraded';
      return 'healthy';
    } catch (error) {
      log.error('Memory health check failed', { error });
      return 'failed';
    }
  }

  /**
   * Check UI health
   */
  private async checkUIHealth(): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      const errorCount = this.getErrorCount('ui');
      if (errorCount > 20) return 'failed';
      if (errorCount > 10) return 'degraded';
      return 'healthy';
    } catch (error) {
      log.ui.error('UI health check failed', { error });
      return 'failed';
    }
  }

  /**
   * Record a component failure
   */
  recordFailure(component: string, error?: Error): void {
    const now = Date.now();
    const key = component.toLowerCase();
    
    const current = this.errorCounts.get(key) || { count: 0, firstError: now };
    
    // Reset count if outside time window
    const threshold = this.thresholds.find(t => t.component === key);
    if (threshold && (now - current.firstError) > threshold.timeWindow) {
      current.count = 0;
      current.firstError = now;
    }
    
    current.count++;
    this.errorCounts.set(key, current);

    log.warn(`Component failure recorded: ${component}`, {
      errorCount: current.count,
      timeWindow: threshold?.timeWindow,
      error: error?.message
    });

    // Check if threshold exceeded
    if (threshold && current.count >= threshold.errorCount) {
      this.triggerDegradation(threshold.degradationLevel, `${component} failure threshold exceeded`);
    }
  }

  /**
   * Trigger degradation to a specific level
   */
  private triggerDegradation(level: DegradationLevel['level'], reason: string): void {
    if (this.shouldUpgradeDegradation(level)) {
      const previousLevel = this.currentLevel;
      this.currentLevel = level;
      
      const degradation = this.degradationLevels[level];
      
      log.warn(`System degradation triggered: ${level}`, {
        reason,
        previousLevel,
        newLevel: level,
        disabledFeatures: degradation.disabledFeatures,
        fallbackBehaviors: degradation.fallbackBehaviors
      });

      addBreadcrumb({
        category: 'system',
        message: `System degraded to ${level}: ${reason}`,
        level: level === 'critical' ? 'error' : 'warning',
        data: {
          previousLevel,
          newLevel: level,
          reason
        }
      });

      // Report critical degradation as errors
      if (level === 'critical' || level === 'severe') {
        errorReporter.reportError(new Error(`System degradation: ${reason}`), {
          component: 'GracefulDegradation',
          action: 'degradation_triggered',
          additionalData: {
            level,
            reason,
            systemHealth: this.systemHealth
          }
        });
      }

      // Notify registered callbacks
      this.degradationCallbacks.forEach(callback => {
        try {
          callback(level);
        } catch (error) {
          log.error('Degradation callback failed', { error });
        }
      });

      // Record performance metric
      performanceMonitor.recordMetric({
        name: 'system_degradation',
        value: this.getLevelNumericValue(level),
        unit: 'level',
        category: 'system',
        tags: {
          level,
          reason: reason.substring(0, 50) // Truncate long reasons
        }
      });
    }
  }

  /**
   * Adjust degradation level based on current system health
   */
  private adjustDegradationLevel(): void {
    let targetLevel: DegradationLevel['level'] = 'none';

    // Determine target level based on system health
    if (this.systemHealth.overall === 'failed') {
      targetLevel = 'critical';
    } else if (this.systemHealth.database === 'failed') {
      targetLevel = 'severe';
    } else if (this.systemHealth.providers === 'failed' || this.systemHealth.memory === 'failed') {
      targetLevel = 'moderate';
    } else if (Object.values(this.systemHealth).some(h => h === 'degraded')) {
      targetLevel = 'minimal';
    }

    // Apply degradation if needed
    if (this.shouldUpgradeDegradation(targetLevel)) {
      this.triggerDegradation(targetLevel, 'System health degradation');
    } else if (this.shouldDowngradeDegradation(targetLevel)) {
      this.recoverFromDegradation(targetLevel);
    }
  }

  /**
   * Recover from degradation
   */
  private recoverFromDegradation(newLevel: DegradationLevel['level']): void {
    const previousLevel = this.currentLevel;
    this.currentLevel = newLevel;

    log.info(`System recovery: degradation level reduced`, {
      previousLevel,
      newLevel,
      systemHealth: this.systemHealth
    });

    addBreadcrumb({
      category: 'system',
      message: `System recovered from ${previousLevel} to ${newLevel}`,
      level: 'info',
      data: {
        previousLevel,
        newLevel,
        systemHealth: this.systemHealth
      }
    });

    // Notify callbacks
    this.degradationCallbacks.forEach(callback => {
      try {
        callback(newLevel);
      } catch (error) {
        log.error('Recovery callback failed', { error });
      }
    });
  }

  /**
   * Check if degradation level should be upgraded (made worse)
   */
  private shouldUpgradeDegradation(newLevel: DegradationLevel['level']): boolean {
    return this.getLevelNumericValue(newLevel) > this.getLevelNumericValue(this.currentLevel);
  }

  /**
   * Check if degradation level should be downgraded (improved)
   */
  private shouldDowngradeDegradation(newLevel: DegradationLevel['level']): boolean {
    return this.getLevelNumericValue(newLevel) < this.getLevelNumericValue(this.currentLevel);
  }

  /**
   * Get numeric value for degradation level comparison
   */
  private getLevelNumericValue(level: DegradationLevel['level']): number {
    const values = { none: 0, minimal: 1, moderate: 2, severe: 3, critical: 4 };
    return values[level];
  }

  /**
   * Get error count for a component
   */
  private getErrorCount(component: string): number {
    const key = component.toLowerCase();
    return this.errorCounts.get(key)?.count || 0;
  }

  // Public API methods

  /**
   * Get current degradation level
   */
  getCurrentLevel(): DegradationLevel {
    return this.degradationLevels[this.currentLevel];
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Check if a feature is disabled
   */
  isFeatureDisabled(feature: string): boolean {
    const currentDegradation = this.degradationLevels[this.currentLevel];
    return currentDegradation.disabledFeatures.includes(feature) ||
           currentDegradation.disabledFeatures.includes('all-advanced-features');
  }

  /**
   * Get fallback behavior value
   */
  getFallbackBehavior<T>(key: string, defaultValue: T): T {
    const currentDegradation = this.degradationLevels[this.currentLevel];
    return currentDegradation.fallbackBehaviors[key] ?? defaultValue;
  }

  /**
   * Register callback for degradation level changes
   */
  onDegradationChange(id: string, callback: (level: DegradationLevel['level']) => void): void {
    this.degradationCallbacks.set(id, callback);
  }

  /**
   * Unregister degradation callback
   */
  offDegradationChange(id: string): void {
    this.degradationCallbacks.delete(id);
  }

  /**
   * Force degradation level (for testing)
   */
  forceDegradation(level: DegradationLevel['level'], reason = 'Manual override'): void {
    this.triggerDegradation(level, reason);
  }

  /**
   * Reset degradation to normal
   */
  resetDegradation(): void {
    this.currentLevel = 'none';
    this.errorCounts.clear();
    this.systemHealth = {
      database: 'healthy',
      providers: 'healthy',
      memory: 'healthy',
      ui: 'healthy',
      overall: 'healthy'
    };

    log.info('System degradation reset to normal');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}

// Create singleton instance
export const gracefulDegradation = new GracefulDegradation();

// Export convenience functions
export const recordFailure = (component: string, error?: Error) => 
  gracefulDegradation.recordFailure(component, error);

export const isFeatureDisabled = (feature: string) => 
  gracefulDegradation.isFeatureDisabled(feature);

export const getFallbackBehavior = <T>(key: string, defaultValue: T) => 
  gracefulDegradation.getFallbackBehavior(key, defaultValue);

export default gracefulDegradation;