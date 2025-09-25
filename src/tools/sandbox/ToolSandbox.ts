import { Worker } from 'worker_threads';
import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { logger } from '../../utils/Logger';

export interface SandboxConfig {
  timeout: number;
  memoryLimit: number;
  cpuLimit?: number;
  allowedPaths?: string[];
  blockedPaths?: string[];
  allowNetwork?: boolean;
  allowFileSystem?: boolean;
  maxFileSize?: number;
  tempDirectory?: string;
}

export interface SandboxResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
}

export class ToolSandbox {
  private config: SandboxConfig;
  private tempDir: string;
  private activeWorkers: Map<string, Worker> = new Map();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = {
      timeout: 30000, // 30 seconds default
      memoryLimit: 128 * 1024 * 1024, // 128MB default
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      allowNetwork: false,
      allowFileSystem: false,
      ...config
    };

    this.tempDir = this.config.tempDirectory || path.join(os.tmpdir(), 'tool-sandbox');
  }

  async initialize(): Promise<void> {
    // Create temp directory if it doesn't exist
    await fs.mkdir(this.tempDir, { recursive: true });
    logger.info('Tool sandbox initialized', { tempDir: this.tempDir });
  }

  /**
   * Execute code in a sandboxed environment using VM
   */
  async executeInVM(code: string, context?: any): Promise<SandboxResult> {
    const startTime = Date.now();

    try {
      // Create a sandboxed context
      const sandbox = this.createSandboxContext(context);

      // Create VM context
      const vmContext = vm.createContext(sandbox);

      // Set timeout
      const options: vm.RunningScriptOptions = {
        timeout: this.config.timeout,
        displayErrors: true,
      };

      // Run the code
      const script = new vm.Script(code);
      const result = script.runInContext(vmContext, options);

      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('VM execution failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute code in a Worker thread for better isolation
   */
  async executeInWorker(
    workerPath: string,
    data: any,
    workerId?: string
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    const id = workerId || `worker_${Date.now()}`;

    try {
      // Create worker with resource limits
      const worker = new Worker(workerPath, {
        workerData: data,
        resourceLimits: {
          maxOldGenerationSizeMb: Math.floor(this.config.memoryLimit / (1024 * 1024)),
          maxYoungGenerationSizeMb: Math.floor(this.config.memoryLimit / (1024 * 1024 * 2)),
        },
      });

      this.activeWorkers.set(id, worker);

      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Worker timeout')), this.config.timeout);
      });

      // Set up worker execution
      const workerPromise = new Promise((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      // Race between timeout and worker completion
      const result = await Promise.race([workerPromise, timeoutPromise]);

      // Clean up
      await worker.terminate();
      this.activeWorkers.delete(id);

      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      // Clean up on error
      const worker = this.activeWorkers.get(id);
      if (worker) {
        await worker.terminate();
        this.activeWorkers.delete(id);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Worker execution failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a tool with file system restrictions
   */
  async executeWithFileSystemRestrictions(
    toolFunction: Function,
    args: any,
    allowedPaths?: string[]
  ): Promise<SandboxResult> {
    const startTime = Date.now();

    try {
      // Validate file paths in arguments
      const paths = this.extractPaths(args);
      const validationResult = await this.validatePaths(paths, allowedPaths);

      if (!validationResult.valid) {
        return {
          success: false,
          error: `Access denied: ${validationResult.reason}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Create a restricted file system proxy
      const restrictedFS = this.createRestrictedFileSystem(allowedPaths);

      // Execute the tool with restricted context
      const context = {
        ...args,
        fs: restrictedFS,
        __dirname: this.tempDir,
        __filename: path.join(this.tempDir, 'tool.js'),
      };

      const result = await toolFunction(context);

      return {
        success: true,
        output: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Tool execution with restrictions failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a sandboxed context with limited capabilities
   */
  private createSandboxContext(userContext?: any): any {
    const sandbox = {
      // Safe globals
      console: {
        log: (...args: any[]) => logger.info('Sandbox log', { message: args }),
        error: (...args: any[]) => logger.error('Sandbox error', { message: args }),
        warn: (...args: any[]) => logger.warn('Sandbox warning', { message: args }),
        info: (...args: any[]) => logger.info('Sandbox info', { message: args }),
      },

      // Math and JSON are safe
      Math,
      JSON,

      // Date with restrictions
      Date: this.createRestrictedDate(),

      // Array and Object methods (safe subset)
      Array,
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign,
        create: Object.create,
      },

      // String, Number, Boolean are safe
      String,
      Number,
      Boolean,

      // User-provided context
      ...userContext,
    };

    // Explicitly block dangerous globals
    const blocked = [
      'process',
      'require',
      'module',
      'exports',
      'global',
      'eval',
      'Function',
      'setTimeout',
      'setInterval',
      'setImmediate',
      'clearTimeout',
      'clearInterval',
      'clearImmediate',
      '__dirname',
      '__filename',
    ];

    blocked.forEach(key => {
      Object.defineProperty(sandbox, key, {
        get() {
          throw new Error(`Access to '${key}' is not allowed in sandbox`);
        },
      });
    });

    return sandbox;
  }

  /**
   * Create a restricted Date object to prevent timing attacks
   */
  private createRestrictedDate(): typeof Date {
    return new Proxy(Date, {
      construct(target, args) {
        return new target(...args);
      },
      get(target, prop) {
        if (prop === 'now') {
          // Add some randomness to prevent timing attacks
          return () => Date.now() + Math.floor(Math.random() * 1000);
        }
        return target[prop as keyof typeof Date];
      },
    });
  }

  /**
   * Create a restricted file system interface
   */
  private createRestrictedFileSystem(allowedPaths?: string[]): any {
    const isPathAllowed = (filePath: string): boolean => {
      if (!allowedPaths || allowedPaths.length === 0) {
        // Only allow temp directory if no paths specified
        return filePath.startsWith(this.tempDir);
      }

      const normalizedPath = path.resolve(filePath);
      return allowedPaths.some(allowed =>
        normalizedPath.startsWith(path.resolve(allowed))
      );
    };

    return {
      readFile: async (filePath: string, encoding?: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }

        const stats = await fs.stat(filePath);
        if (stats.size > this.config.maxFileSize!) {
          throw new Error(`File too large: ${filePath}`);
        }

        return fs.readFile(filePath, encoding as any);
      },

      writeFile: async (filePath: string, data: any, encoding?: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }

        // Check data size
        const size = Buffer.byteLength(data);
        if (size > this.config.maxFileSize!) {
          throw new Error('Data too large to write');
        }

        return fs.writeFile(filePath, data, encoding as any);
      },

      mkdir: async (dirPath: string, options?: any) => {
        if (!isPathAllowed(dirPath)) {
          throw new Error(`Access denied: ${dirPath}`);
        }

        return fs.mkdir(dirPath, options);
      },

      readdir: async (dirPath: string, options?: any) => {
        if (!isPathAllowed(dirPath)) {
          throw new Error(`Access denied: ${dirPath}`);
        }

        return fs.readdir(dirPath, options);
      },

      stat: async (filePath: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }

        return fs.stat(filePath);
      },

      unlink: async (filePath: string) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }

        return fs.unlink(filePath);
      },
    };
  }

  /**
   * Extract file paths from tool arguments
   */
  private extractPaths(args: any): string[] {
    const paths: string[] = [];

    const extract = (obj: any) => {
      if (typeof obj === 'string' && (obj.includes('/') || obj.includes('\\'))) {
        paths.push(obj);
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(extract);
      }
    };

    extract(args);
    return paths;
  }

  /**
   * Validate file paths against allowed and blocked lists
   */
  private async validatePaths(
    paths: string[],
    allowedPaths?: string[]
  ): Promise<{ valid: boolean; reason?: string }> {
    for (const filePath of paths) {
      const normalizedPath = path.resolve(filePath);

      // Check blocked paths
      if (this.config.blockedPaths) {
        for (const blocked of this.config.blockedPaths) {
          if (normalizedPath.startsWith(path.resolve(blocked))) {
            return {
              valid: false,
              reason: `Path is blocked: ${filePath}`,
            };
          }
        }
      }

      // Check allowed paths
      const effectiveAllowedPaths = allowedPaths || this.config.allowedPaths;
      if (effectiveAllowedPaths) {
        const isAllowed = effectiveAllowedPaths.some(allowed =>
          normalizedPath.startsWith(path.resolve(allowed))
        );

        if (!isAllowed) {
          return {
            valid: false,
            reason: `Path is not in allowed list: ${filePath}`,
          };
        }
      }

      // Check if path escapes sandbox
      if (normalizedPath.includes('..')) {
        return {
          valid: false,
          reason: `Path traversal detected: ${filePath}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Terminate all active workers
    for (const [id, worker] of this.activeWorkers) {
      try {
        await worker.terminate();
        logger.info(`Terminated worker ${id}`);
      } catch (error) {
        logger.error(`Failed to terminate worker ${id}`, { error });
      }
    }
    this.activeWorkers.clear();

    // Clean up temp directory
    try {
      await fs.rmdir(this.tempDir, { recursive: true });
      logger.info('Cleaned up sandbox temp directory');
    } catch (error) {
      logger.error('Failed to clean up temp directory', { error });
    }
  }

  /**
   * Get sandbox statistics
   */
  getStats(): {
    activeWorkers: number;
    tempDirectory: string;
    config: SandboxConfig;
  } {
    return {
      activeWorkers: this.activeWorkers.size,
      tempDirectory: this.tempDir,
      config: this.config,
    };
  }
}