import { PerformanceMetric } from '../types/performance';

/**
 * Service for calculating the cost of LLM interactions
 * Requirements: 11.3
 */
export class CostService {
  // Prices per 1M tokens (input, output)
  private pricingTable: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 1.5, output: 2 },
    'claude-2': { input: 8, output: 24 },
    'default': { input: 0.5, output: 1.5 }, // Default for local models
  };

  /**
   * Calculate the cost of a single LLM interaction
   */
  calculateCost(metric: PerformanceMetric): number {
    const modelKey = Object.keys(this.pricingTable).find(key => metric.model_id.includes(key)) || 'default';
    const pricing = this.pricingTable[modelKey];

    const promptTokens = metric.prompt_tokens || 0;
    const completionTokens = metric.completion_tokens || 0;

    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Get the pricing for a model
   */
  getPricing(modelId: string): { input: number; output: number } {
    const modelKey = Object.keys(this.pricingTable).find(key => modelId.includes(key)) || 'default';
    return this.pricingTable[modelKey];
  }

  /**
   * Generate cost optimization suggestions
   */
  async getCostOptimizationSuggestions(performanceData: any[]): Promise<string[]> {
    const suggestions: string[] = [];

    // Suggest cheaper models with good performance
    const sortedByCost = performanceData.sort((a, b) => {
      const costA = this.calculateCost({ model_id: a.modelId, prompt_tokens: a.avgPromptTokens, completion_tokens: a.avgCompletionTokens } as any);
      const costB = this.calculateCost({ model_id: b.modelId, prompt_tokens: b.avgPromptTokens, completion_tokens: b.avgCompletionTokens } as any);
      return costA - costB;
    });

    if (sortedByCost.length > 1) {
      const cheapestGoodModel = sortedByCost.find(m => m.goodFeedback > m.badFeedback);
      if (cheapestGoodModel) {
        suggestions.push(`Consider using ${cheapestGoodModel.modelId}, which has good performance and is cost-effective.`);
      }
    }

    return suggestions;
  }
}
