import { PerformanceRepository } from '../database/PerformanceRepository';
import { CostService } from './CostService';

/**
 * Service for tracking and monitoring budgets
 * Requirements: 11.3
 */
export class BudgetService {
  private performanceRepository: PerformanceRepository;
  private costService: CostService;
  private budget: number = 0; // Monthly budget in USD

  constructor(performanceRepository: PerformanceRepository, costService: CostService) {
    this.performanceRepository = performanceRepository;
    this.costService = costService;
  }

  /**
   * Set the monthly budget
   */
  setBudget(budget: number): void {
    this.budget = budget;
  }

  /**
   * Get the current monthly spending
   */
  async getCurrentSpending(): Promise<number> {
    // For simplicity, we'll calculate the cost of all interactions in the database.
    // In a real application, you would filter by the current month.
    const allMetrics = await this.performanceRepository.getAllMetrics(); // This method needs to be created
    let totalCost = 0;

    for (const metric of allMetrics) {
      totalCost += this.costService.calculateCost(metric);
    }

    return totalCost;
  }

  /**
   * Get the budget status
   */
  async getBudgetStatus(): Promise<{ budget: number; spending: number; remaining: number }> {
    const spending = await this.getCurrentSpending();
    return {
      budget: this.budget,
      spending,
      remaining: this.budget - spending,
    };
  }
}
