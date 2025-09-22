import { Database } from './Database';
import { PerformanceMetric } from '../types/performance';

/**
 * Repository for performance metrics
 * Requirements: 11.1
 */
export class PerformanceRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new performance metric record
   */
  async create(metric: PerformanceMetric): Promise<void> {
    const query = `
      INSERT INTO performance_metrics (
        id, message_id, model_id, processing_time, token_count, error, prompt_tokens, completion_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db['executeQuery'](query, [
      metric.id,
      metric.message_id,
      metric.model_id,
      metric.processing_time,
      metric.token_count,
      metric.error,
      metric.prompt_tokens,
      metric.completion_tokens
    ]);
  }

  /**
   * Get performance metrics for a given message ID
   */
  async getByMessageId(messageId: string): Promise<PerformanceMetric[]> {
    const query = 'SELECT * FROM performance_metrics WHERE message_id = ?';
    return this.db['executeQuery'](query, [messageId], 'all');
  }

  /**
   * Get all performance metrics for a given model ID
   */
  async getByModelId(modelId: string): Promise<PerformanceMetric[]> {
    const query = 'SELECT * FROM performance_metrics WHERE model_id = ?';
    return this.db['executeQuery'](query, [modelId], 'all');
  }

  /**
   * Get all performance metrics
   */
  async getAllMetrics(): Promise<PerformanceMetric[]> {
    const query = 'SELECT * FROM performance_metrics';
    return this.db['executeQuery'](query, [], 'all');
  }

  /**
   * Get all performance metrics for a given task ID
   */
  async getByTaskId(taskId: string): Promise<PerformanceMetric[]> {
    try {
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      const query = 'SELECT * FROM performance_metrics WHERE message_id IN (SELECT id FROM messages WHERE task_id = ?) ORDER BY created_at DESC';
      return this.db['executeQuery'](query, [taskId], 'all');
    } catch (error) {
      throw new Error(`Failed to get performance metrics by task ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
