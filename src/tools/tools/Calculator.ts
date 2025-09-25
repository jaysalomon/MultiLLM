import { Tool } from '../../types/providers';
import { create, all } from 'mathjs';

const math = create(all);

export class Calculator {
  getToolDefinition(): Tool {
    return {
      type: 'function',
      function: {
        name: 'calculator',
        description: 'Perform mathematical calculations. Supports basic arithmetic, algebra, trigonometry, statistics, and more.',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sin(pi/2)", "sqrt(16)")',
            },
            precision: {
              type: 'number',
              description: 'Number of decimal places for the result (default: 10)',
            },
          },
          required: ['expression'],
        },
      },
    };
  }

  async execute(args: { expression: string; precision?: number }): Promise<string> {
    try {
      const precision = args.precision || 10;

      // Configure math.js
      math.config({
        number: 'BigNumber',
        precision: precision + 10, // Extra precision for internal calculations
      });

      // Evaluate the expression
      const result = math.evaluate(args.expression);

      // Format the result
      const formatted = this.formatResult(result, precision);

      return JSON.stringify({
        success: true,
        expression: args.expression,
        result: formatted,
        type: typeof result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Calculation failed: ${errorMessage}`,
        expression: args.expression,
        hint: this.getErrorHint(errorMessage),
      });
    }
  }

  private formatResult(result: any, precision: number): string | number | object {
    if (result === null || result === undefined) {
      return 'undefined';
    }

    // Handle different result types
    if (typeof result === 'number' || result.type === 'BigNumber') {
      return math.format(result, { precision });
    }

    if (result.type === 'Complex') {
      return {
        real: math.format(result.re, { precision }),
        imaginary: math.format(result.im, { precision }),
        string: result.toString(),
      };
    }

    if (Array.isArray(result)) {
      return result.map(item => this.formatResult(item, precision));
    }

    if (result.type === 'Matrix') {
      return result.toArray().map((row: any) =>
        Array.isArray(row)
          ? row.map(item => this.formatResult(item, precision))
          : this.formatResult(row, precision)
      );
    }

    // Default: convert to string
    return result.toString();
  }

  private getErrorHint(errorMessage: string): string {
    if (errorMessage.includes('undefined symbol')) {
      return 'Unknown function or variable. Common functions: sin, cos, tan, log, ln, sqrt, abs, round, floor, ceil';
    }

    if (errorMessage.includes('parenthesis')) {
      return 'Check that all parentheses are properly matched';
    }

    if (errorMessage.includes('divide by zero')) {
      return 'Division by zero is not allowed';
    }

    if (errorMessage.includes('syntax')) {
      return 'Check the syntax. Examples: "2 * 3", "sin(pi/2)", "sqrt(16)", "[1, 2, 3] * 2"';
    }

    return 'Check the expression syntax. Use standard mathematical notation.';
  }

  // Additional helper for common calculations
  async executeAdvanced(operation: string, params: any): Promise<string> {
    try {
      let result: any;

      switch (operation) {
        case 'statistics':
          result = this.calculateStatistics(params.data);
          break;

        case 'solve':
          result = this.solveEquation(params.equation, params.variable);
          break;

        case 'derivative':
          result = this.calculateDerivative(params.expression, params.variable);
          break;

        case 'integral':
          result = this.calculateIntegral(params.expression, params.variable, params.bounds);
          break;

        default:
          return JSON.stringify({ error: `Unknown operation: ${operation}` });
      }

      return JSON.stringify({
        success: true,
        operation,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Advanced calculation failed: ${errorMessage}`,
      });
    }
  }

  private calculateStatistics(data: number[]): object {
    return {
      mean: math.mean(data),
      median: math.median(data),
      mode: math.mode(data),
      std: math.std(data),
      variance: math.variance(data),
      min: math.min(data),
      max: math.max(data),
      sum: math.sum(data),
      count: data.length,
    };
  }

  private solveEquation(equation: string, variable: string = 'x'): any {
    // Simple linear equation solver
    // For more complex equations, you'd need a symbolic math library
    try {
      // This is a simplified example
      // In production, you'd want to use a proper equation solver
      const expr = math.parse(equation);
      return `Equation solving requires symbolic math capabilities`;
    } catch (error) {
      throw new Error('Could not parse equation');
    }
  }

  private calculateDerivative(expression: string, variable: string = 'x'): any {
    try {
      const expr = math.parse(expression);
      const derivative = math.derivative(expr, variable);
      return derivative.toString();
    } catch (error) {
      throw new Error('Could not calculate derivative');
    }
  }

  private calculateIntegral(
    expression: string,
    variable: string = 'x',
    bounds?: [number, number]
  ): any {
    // Note: math.js doesn't have built-in integration
    // This is a placeholder for where you'd implement numerical integration
    return `Integration requires numerical methods or symbolic math library`;
  }
}