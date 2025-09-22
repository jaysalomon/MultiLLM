import { Database } from './Database';
import { QualityFeedback } from '../types/performance';

/**
 * Repository for quality feedback
 * Requirements: 11.2
 */
export class QualityFeedbackRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new quality feedback record
   */
  async create(feedback: QualityFeedback): Promise<void> {
    const query = `
      INSERT INTO quality_feedback (
        id, message_id, model_id, user_rating, accuracy, helpfulness, relevance, completeness, feedback_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db['executeQuery'](query, [
      feedback.id,
      feedback.message_id,
      feedback.model_id,
      feedback.user_rating,
      feedback.accuracy || null,
      feedback.helpfulness || null,
      feedback.relevance || null,
      feedback.completeness || null,
      feedback.feedback_text || null
    ]);
  }

  /**
   * Get quality feedback for a given message ID
   */
  async getByMessageId(messageId: string): Promise<QualityFeedback[]> {
    const query = 'SELECT * FROM quality_feedback WHERE message_id = ?';
    return this.db['executeQuery'](query, [messageId], 'all');
  }

  /**
   * Get all quality feedback
   */
  async getAllFeedback(): Promise<QualityFeedback[]> {
    try {
      const query = 'SELECT * FROM quality_feedback ORDER BY created_at DESC';
      return this.db['executeQuery'](query, [], 'all');
    } catch (error) {
      throw new Error(`Failed to get all quality feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
