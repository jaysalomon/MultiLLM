import { ToolCall } from '../types/chat';
import { toolRegistry } from './ToolRegistry';
import {
  CodeInterpreter,
  WebSearch,
  FileOperations,
  Calculator,
  KnowledgeSearch
} from './tools';
import { KnowledgeBase } from '../services/KnowledgeBase';

class ToolExecutor {
  private tools: Map<string, any> = new Map();
  private knowledgeBase: KnowledgeBase | null = null;

  constructor() {
    this.initializeTools();
  }

  private initializeTools(): void {
    // Create tool instances
    const codeInterpreter = new CodeInterpreter();
    const webSearch = new WebSearch();
    const fileOperations = new FileOperations();
    const calculator = new Calculator();
    const knowledgeSearch = new KnowledgeSearch();

    // Register tools
    toolRegistry.register(codeInterpreter.getToolDefinition());
    toolRegistry.register(webSearch.getToolDefinition());
    toolRegistry.register(fileOperations.getToolDefinition());
    toolRegistry.register(calculator.getToolDefinition());
    toolRegistry.register(knowledgeSearch.getToolDefinition());

    // Store tool instances
    this.tools.set('code_interpreter', codeInterpreter);
    this.tools.set('web_search', webSearch);
    this.tools.set('file_operations', fileOperations);
    this.tools.set('calculator', calculator);
    this.tools.set('knowledge_search', knowledgeSearch);
  }

  setKnowledgeBase(kb: KnowledgeBase): void {
    this.knowledgeBase = kb;
    const knowledgeSearch = this.tools.get('knowledge_search') as KnowledgeSearch;
    if (knowledgeSearch) {
      knowledgeSearch.setKnowledgeBase(kb);
    }
  }

  async execute(toolCall: ToolCall): Promise<string> {
    const tool = toolRegistry.get(toolCall.function.name);

    if (!tool) {
      return JSON.stringify({
        error: `Tool '${toolCall.function.name}' not found.`,
        available_tools: Array.from(this.tools.keys())
      });
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);
      const toolInstance = this.tools.get(toolCall.function.name);

      if (!toolInstance) {
        return JSON.stringify({
          error: `Tool instance '${toolCall.function.name}' not initialized.`
        });
      }

      // Execute the tool
      const result = await toolInstance.execute(args);

      // Log tool usage for analytics
      this.logToolUsage(toolCall.function.name, args, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Error executing tool '${toolCall.function.name}': ${errorMessage}`
      });
    }
  }

  async executeBatch(toolCalls: ToolCall[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Execute tools in parallel where possible
    const promises = toolCalls.map(async (toolCall) => {
      const result = await this.execute(toolCall);
      return { id: toolCall.id, result };
    });

    const executionResults = await Promise.all(promises);

    for (const { id, result } of executionResults) {
      results.set(id, result);
    }

    return results;
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  getToolDefinition(toolName: string) {
    return toolRegistry.get(toolName);
  }

  private logToolUsage(toolName: string, args: any, result: string): void {
    // You could send this to analytics or store in database
    console.log(`Tool used: ${toolName}`, {
      timestamp: new Date().toISOString(),
      tool: toolName,
      argsSize: JSON.stringify(args).length,
      resultSize: result.length,
      success: !result.includes('"error"'),
    });
  }
}

export const toolExecutor = new ToolExecutor();