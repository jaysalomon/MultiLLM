import { QualityFeedbackRepository } from '../database/QualityFeedbackRepository';
import { PerformanceRepository } from '../database/PerformanceRepository';
import { QualityFeedback } from '../types/performance';

/**
 * Service for performance and quality feedback
 * Requirements: 11.1, 11.2
 */
export class PerformanceService {
  private qualityFeedbackRepository: QualityFeedbackRepository;
  private performanceRepository: PerformanceRepository;

  constructor(qualityFeedbackRepository: QualityFeedbackRepository, performanceRepository: PerformanceRepository) {
    this.qualityFeedbackRepository = qualityFeedbackRepository;
    this.performanceRepository = performanceRepository;
  }

  /**
   * Save quality feedback for a message
   */
  async saveFeedback(messageId: string, modelId: string, feedback: 'good' | 'bad'): Promise<void> {
    const feedbackRecord: QualityFeedback = {
      id: `feedback_${messageId}`,
      message_id: messageId,
      model_id: modelId,
      user_rating: feedback === 'good' ? 5 : 1,
      created_at: new Date(),
    };
    await this.qualityFeedbackRepository.create(feedbackRecord);
  }

  /**
   * Get aggregated performance data for all models
   */
  async getPerformanceData(taskId?: string): Promise<any[]> {
    const allMetrics = taskId 
      ? await this.performanceRepository.getByTaskId(taskId)
      : await this.performanceRepository.getAllMetrics();
    const allFeedback = await this.qualityFeedbackRepository.getAllFeedback(); // This method needs to be created

    const modelData: Record<string, any> = {};

    for (const metric of allMetrics) {
      if (!modelData[metric.model_id]) {
        modelData[metric.model_id] = {
          modelId: metric.model_id,
          processingTimes: [],
          promptTokens: [],
          completionTokens: [],
          goodFeedback: 0,
          badFeedback: 0,
        };
      }
      modelData[metric.model_id].processingTimes.push(metric.processing_time);
      modelData[metric.model_id].promptTokens.push(metric.prompt_tokens || 0);
      modelData[metric.model_id].completionTokens.push(metric.completion_tokens || 0);
    }

    for (const feedback of allFeedback) {
      if (modelData[feedback.model_id]) {
        if (feedback.user_rating >= 4) {
          modelData[feedback.model_id].goodFeedback++;
        } else {
          modelData[feedback.model_id].badFeedback++;
        }
      }
    }

    return Object.values(modelData).map(data => ({
      modelId: data.modelId,
      avgProcessingTime: data.processingTimes.reduce((a: number, b: number) => a + b, 0) / data.processingTimes.length,
      avgPromptTokens: data.promptTokens.reduce((a: number, b: number) => a + b, 0) / data.promptTokens.length,
      avgCompletionTokens: data.completionTokens.reduce((a: number, b: number) => a + b, 0) / data.completionTokens.length,
      goodFeedback: data.goodFeedback,
      badFeedback: data.badFeedback,
    }));
  }

  /**
   * Get aggregated performance data as a CSV string
   */
  async getPerformanceDataAsCsv(): Promise<string> {
    const data = await this.getPerformanceData();
    if (data.length === 0) {
      return '';
    }

    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map(row => Object.values(row).join(',')).join('\n');

    return header + rows;
  }

  /**
   * Get recommended model for a task
   */
  async getRecommendedModel(taskId: string): Promise<string | undefined> {
    const performanceData = await this.getPerformanceData(taskId);
    if (performanceData.length === 0) {
      return undefined;
    }

    // Recommend the model with the best feedback and lowest processing time
    const sortedByPerformance = performanceData.sort((a, b) => {
      const scoreA = (a.goodFeedback - a.badFeedback) - (a.avgProcessingTime / 1000);
      const scoreB = (b.goodFeedback - b.badFeedback) - (b.avgProcessingTime / 1000);
      return scoreB - scoreA;
    });

    return sortedByPerformance[0]?.modelId;
  }
}
