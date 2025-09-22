/**
 * Renderer-specific performance types
 * Requirements: 11.1, 11.4
 */

import { PerformanceMetric, QualityFeedback, Task } from '../../types/performance';

// Re-export base types
export type { PerformanceMetric, QualityFeedback, Task };

/**
 * Performance data for dashboard display
 */
export interface PerformanceData {
  modelId: string;
  modelName: string;
  avgProcessingTime: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  totalRequests: number;
  successRate: number;
  goodFeedback: number;
  badFeedback: number;
  totalCost?: number;
  avgCostPerRequest?: number;
  lastUsed: Date;
}

/**
 * Chart data point for performance visualization
 */
export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  modelId: string;
  modelName: string;
  metric: 'processing_time' | 'token_count' | 'cost' | 'quality_rating';
}

/**
 * Performance chart configuration
 */
export interface PerformanceChartProps {
  data: ChartDataPoint[];
  metric: 'processing_time' | 'token_count' | 'cost' | 'quality_rating';
  timeRange: 'hour' | 'day' | 'week' | 'month';
  modelIds?: string[];
  isLoading?: boolean;
  error?: string;
  onMetricChange?: (metric: string) => void;
  onTimeRangeChange?: (range: string) => void;
  onModelFilter?: (modelIds: string[]) => void;
}

/**
 * Task management component props
 */
export interface TaskManagementProps {
  tasks?: Task[];
  selectedTaskId?: string;
  isLoading?: boolean;
  error?: string;
  onTaskSelect?: (taskId: string) => void;
  onTaskCreate?: (name: string, description?: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

/**
 * Performance summary for quick overview
 */
export interface PerformanceSummary {
  totalRequests: number;
  avgProcessingTime: number;
  totalCost: number;
  topPerformingModel: string;
  mostUsedModel: string;
  qualityScore: number;
  period: string;
}

/**
 * Model comparison data
 */
export interface ModelComparison {
  modelId: string;
  modelName: string;
  metrics: {
    speed: number; // relative score 0-100
    quality: number; // relative score 0-100
    cost: number; // relative score 0-100 (lower is better)
    reliability: number; // relative score 0-100
  };
  recommendation: 'excellent' | 'good' | 'average' | 'poor';
  bestFor: string[]; // task types this model excels at
}

/**
 * Cost optimization suggestion
 */
export interface CostOptimizationSuggestion {
  type: 'model_switch' | 'token_optimization' | 'usage_pattern' | 'budget_alert';
  title: string;
  description: string;
  potentialSavings: number;
  confidence: number; // 0-100
  actionRequired: boolean;
  suggestedAction?: string;
}