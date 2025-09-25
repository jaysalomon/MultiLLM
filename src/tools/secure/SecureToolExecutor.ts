import { ToolCall } from '../../types/chat';
import { ToolSandbox, SandboxConfig } from '../sandbox/ToolSandbox';
import { toolRegistry } from '../ToolRegistry';
import { logger } from '../../utils/Logger';
import * as path from 'path';
import * as os from 'os';

export interface SecurityPolicy {
  allowedTools: string[];
  blockedTools?: string[];
  maxExecutionTime: number;
  maxMemory: number;
  allowFileSystem: boolean;
  allowNetwork: boolean;
  allowedPaths?: string[];
  blockedPaths?: string[];
  requireApproval?: boolean;
  logExecutions?: boolean;
}

export interface ExecutionLog {
  toolName: string;
  arguments: any;
  result: any;
  executionTime: number;
  timestamp: Date;
  approved: boolean;
  userId?: string;
}

export class SecureToolExecutor {
  private sandbox: ToolSandbox;
  private policy: SecurityPolicy;
  private executionLogs: ExecutionLog[] = [];
  private approvalCallbacks: Map<string, (approved: boolean) => void> = new Map();

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = {
      allowedTools: ['calculator', 'knowledge_search', 'web_search'],
      maxExecutionTime: 30000,
      maxMemory: 128 * 1024 * 1024,
      allowFileSystem: false,
      allowNetwork: false,
      logExecutions: true,
      ...policy,
    };

    // Default blocked paths for security
    if (!this.policy.blockedPaths) {
      this.policy.blockedPaths = [
        os.homedir(),
        '/etc',
        '/usr',
        '/bin',
        '/sbin',
        'C:\\Windows',
        'C:\\Program Files',
      ];
    }

    // Default allowed paths (sandbox only)
    if (!this.policy.allowedPaths) {
      this.policy.allowedPaths = [
        path.join(os.tmpdir(), 'tool-sandbox'),
        path.join(process.cwd(), 'workspace'),
      ];
    }

    const sandboxConfig: SandboxConfig = {
      timeout: this.policy.maxExecutionTime,
      memoryLimit: this.policy.maxMemory,
      allowNetwork: this.policy.allowNetwork,
      allowFileSystem: this.policy.allowFileSystem,
      allowedPaths: this.policy.allowedPaths,
      blockedPaths: this.policy.blockedPaths,
    };

    this.sandbox = new ToolSandbox(sandboxConfig);
  }

  async initialize(): Promise<void> {
    await this.sandbox.initialize();
    logger.info('Secure tool executor initialized', { policy: this.policy });
  }

  async execute(toolCall: ToolCall, userId?: string): Promise<string> {
    const startTime = Date.now();

    try {
      // Check if tool is allowed
      const validationResult = this.validateToolCall(toolCall);
      if (!validationResult.valid) {
        return JSON.stringify({
          error: validationResult.reason,
          code: 'SECURITY_VIOLATION',
        });
      }

      // Check if approval is required
      if (this.policy.requireApproval) {
        const approved = await this.requestApproval(toolCall, userId);
        if (!approved) {
          return JSON.stringify({
            error: 'Tool execution not approved by user',
            code: 'USER_DENIED',
          });
        }
      }

      // Parse arguments
      const args = JSON.parse(toolCall.function.arguments);

      // Execute based on tool type
      let result: any;
      const toolName = toolCall.function.name;

      switch (toolName) {
        case 'code_interpreter':
          result = await this.executeCodeInterpreter(args);
          break;

        case 'file_operations':
          result = await this.executeFileOperations(args);
          break;

        case 'web_search':
          result = await this.executeWebSearch(args);
          break;

        case 'calculator':
          result = await this.executeCalculator(args);
          break;

        case 'knowledge_search':
          result = await this.executeKnowledgeSearch(args);
          break;

        default:
          result = await this.executeGenericTool(toolName, args);
      }

      // Log execution if enabled
      if (this.policy.logExecutions) {
        this.logExecution({
          toolName,
          arguments: args,
          result,
          executionTime: Date.now() - startTime,
          timestamp: new Date(),
          approved: true,
          userId,
        });
      }

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Secure tool execution failed', {
        tool: toolCall.function.name,
        error: errorMessage,
      });

      return JSON.stringify({
        error: `Tool execution failed: ${errorMessage}`,
        code: 'EXECUTION_ERROR',
      });
    }
  }

  private validateToolCall(toolCall: ToolCall): { valid: boolean; reason?: string } {
    const toolName = toolCall.function.name;

    // Check if tool exists
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return {
        valid: false,
        reason: `Tool '${toolName}' not found`,
      };
    }

    // Check if tool is blocked
    if (this.policy.blockedTools?.includes(toolName)) {
      return {
        valid: false,
        reason: `Tool '${toolName}' is blocked by security policy`,
      };
    }

    // Check if tool is allowed
    if (!this.policy.allowedTools.includes(toolName)) {
      return {
        valid: false,
        reason: `Tool '${toolName}' is not in allowed list`,
      };
    }

    // Validate arguments size (prevent DOS)
    const argsSize = JSON.stringify(toolCall.function.arguments).length;
    if (argsSize > 1024 * 1024) { // 1MB limit
      return {
        valid: false,
        reason: 'Tool arguments too large',
      };
    }

    return { valid: true };
  }

  private async executeCodeInterpreter(args: any): Promise<any> {
    // Code interpreter is high risk - execute in VM with strict limits
    const code = args.code;

    // Validate code doesn't contain dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /exec\s*\(/,
      /spawn\s*\(/,
      /\bprocess\b/,
      /\b__dirname\b/,
      /\b__filename\b/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          error: 'Code contains restricted patterns',
          code: 'SECURITY_VIOLATION',
        };
      }
    }

    // Execute in sandbox
    const result = await this.sandbox.executeInVM(code, {
      // Provide safe mathematical functions
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sqrt: Math.sqrt,
      pow: Math.pow,
      abs: Math.abs,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      min: Math.min,
      max: Math.max,
      random: Math.random,
    });

    return result.success
      ? { success: true, output: result.output }
      : { error: result.error, code: 'EXECUTION_ERROR' };
  }

  private async executeFileOperations(args: any): Promise<any> {
    if (!this.policy.allowFileSystem) {
      return {
        error: 'File system access is disabled',
        code: 'PERMISSION_DENIED',
      };
    }

    // Import the actual tool
    const { FileOperations } = await import('../tools/FileOperations');
    const tool = new FileOperations(this.policy.allowedPaths?.[0]);

    // Execute with file system restrictions
    const result = await this.sandbox.executeWithFileSystemRestrictions(
      async (context: any) => tool.execute(args),
      args,
      this.policy.allowedPaths
    );

    return result.success
      ? JSON.parse(result.output)
      : { error: result.error, code: 'EXECUTION_ERROR' };
  }

  private async executeWebSearch(args: any): Promise<any> {
    if (!this.policy.allowNetwork) {
      // Return mock results for demonstration
      return {
        results: [
          {
            title: 'Mock Result (Network Disabled)',
            url: 'https://example.com',
            snippet: 'Network access is disabled in sandbox mode',
          },
        ],
        warning: 'Network access is disabled. These are mock results.',
      };
    }

    // Import and execute with network restrictions
    const { WebSearch } = await import('../tools/WebSearch');
    const tool = new WebSearch();

    // Limit number of results to prevent abuse
    args.num_results = Math.min(args.num_results || 5, 10);

    return tool.execute(args);
  }

  private async executeCalculator(args: any): Promise<any> {
    // Calculator is relatively safe, but still execute in sandbox
    const { Calculator } = await import('../tools/Calculator');
    const tool = new Calculator();

    // Validate expression doesn't contain dangerous patterns
    const expression = args.expression;
    if (expression.length > 1000) {
      return {
        error: 'Expression too long',
        code: 'VALIDATION_ERROR',
      };
    }

    const result = await this.sandbox.executeInVM(
      `
      const math = require('mathjs');
      math.evaluate('${expression.replace(/'/g, "\\'")}');
      `,
      {}
    );

    return result.success
      ? { success: true, result: result.output }
      : { error: result.error, code: 'EXECUTION_ERROR' };
  }

  private async executeKnowledgeSearch(args: any): Promise<any> {
    // Knowledge search is safe - just query the knowledge base
    const { KnowledgeSearch } = await import('../tools/KnowledgeSearch');
    const tool = new KnowledgeSearch();

    // Limit query length
    if (args.query.length > 500) {
      args.query = args.query.substring(0, 500);
    }

    // Limit max results
    args.max_results = Math.min(args.max_results || 5, 20);

    return tool.execute(args);
  }

  private async executeGenericTool(toolName: string, args: any): Promise<any> {
    // Generic tool execution with sandboxing
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return {
        error: `Tool '${toolName}' not found`,
        code: 'NOT_FOUND',
      };
    }

    // Execute in sandbox with restrictions
    const result = await this.sandbox.executeInVM(
      `
      // Tool execution in restricted environment
      const result = ${JSON.stringify(args)};
      result;
      `,
      {}
    );

    return result.success
      ? { success: true, result: result.output }
      : { error: result.error, code: 'EXECUTION_ERROR' };
  }

  private async requestApproval(toolCall: ToolCall, userId?: string): Promise<boolean> {
    return new Promise((resolve) => {
      const approvalId = `approval_${Date.now()}`;

      logger.info('Requesting tool execution approval', {
        approvalId,
        tool: toolCall.function.name,
        userId,
      });

      // Store callback for approval
      this.approvalCallbacks.set(approvalId, resolve);

      // Emit approval request event (to be handled by UI)
      process.emit('tool:approval:request' as any, {
        approvalId,
        toolCall,
        userId,
        timestamp: new Date(),
      });

      // Auto-deny after timeout
      setTimeout(() => {
        if (this.approvalCallbacks.has(approvalId)) {
          this.approvalCallbacks.delete(approvalId);
          resolve(false);
        }
      }, 30000); // 30 second timeout
    });
  }

  approveToolExecution(approvalId: string): void {
    const callback = this.approvalCallbacks.get(approvalId);
    if (callback) {
      callback(true);
      this.approvalCallbacks.delete(approvalId);
    }
  }

  denyToolExecution(approvalId: string): void {
    const callback = this.approvalCallbacks.get(approvalId);
    if (callback) {
      callback(false);
      this.approvalCallbacks.delete(approvalId);
    }
  }

  private logExecution(log: ExecutionLog): void {
    this.executionLogs.push(log);

    // Keep only last 1000 logs
    if (this.executionLogs.length > 1000) {
      this.executionLogs.shift();
    }

    logger.info('Tool execution logged', {
      tool: log.toolName,
      executionTime: log.executionTime,
      approved: log.approved,
    });
  }

  getExecutionLogs(limit: number = 100): ExecutionLog[] {
    return this.executionLogs.slice(-limit);
  }

  updatePolicy(updates: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    logger.info('Security policy updated', { policy: this.policy });
  }

  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  async cleanup(): Promise<void> {
    await this.sandbox.cleanup();
  }
}