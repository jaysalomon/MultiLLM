/**
 * Performance metric for an LLM interaction
 * Requirements: 11.1
 */
export interface PerformanceMetric {
  id: string;
  message_id: string;
  model_id: string;
  processing_time: number; // in milliseconds
  token_count?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  error?: string;
  created_at: Date;
}

/**
 * Quality feedback for an LLM response
 * Requirements: 11.2
 */
export interface QualityFeedback {
  id: string;
  message_id: string;
  model_id: string;
  user_rating: 1 | 2 | 3 | 4 | 5;
  accuracy?: number;
  helpfulness?: number;
  relevance?: number;
  completeness?: number;
  feedback_text?: string;
  created_at: Date;
}

/**
 * Task for performance analysis
 * Requirements: 11.5
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
}
