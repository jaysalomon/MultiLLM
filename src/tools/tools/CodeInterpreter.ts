import { Tool } from '../../types/providers';

const isRenderer = typeof process !== 'undefined' && process.type === 'renderer';

type ExecAsyncFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

const getDynamicRequire = (): ((moduleId: string) => any) | null => {
  if (isRenderer) {
    return null;
  }

  try {
    return Function('return require')();
  } catch {
    return null;
  }
};

export class CodeInterpreter {
  private execAsync: ExecAsyncFn | null = null;
  private initialised = false;

  getToolDefinition(): Tool {
    return {
      type: 'function',
      function: {
        name: 'code_interpreter',
        description: 'Executes Python code in a sandboxed environment and returns the output.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute.',
            },
          },
          required: ['code'],
        },
      },
    };
  }

  private async ensureInitialised(): Promise<void> {
    if (this.initialised || isRenderer) {
      return;
    }

    const dynamicRequire = getDynamicRequire();

    if (!dynamicRequire) {
      throw new Error('Code interpreter is unavailable: cannot access Node runtime.');
    }

    const { exec } = dynamicRequire('child_process') as { exec: (command: string) => void };
    const { promisify } = dynamicRequire('util') as { promisify: (fn: any) => ExecAsyncFn };

    this.execAsync = promisify(exec);
    this.initialised = true;
  }

  async execute(code: string): Promise<string> {
    if (isRenderer) {
      return 'Error executing code: Code interpreter is unavailable in the renderer process.';
    }

    try {
      await this.ensureInitialised();

      if (!this.execAsync) {
        return 'Error executing code: Failed to initialise code interpreter.';
      }

      const sanitizedCode = code.replace(/"/g, '\"');
      const { stdout, stderr } = await this.execAsync(`python -c "${sanitizedCode}"`);

      if (stderr) {
        return `Error:\n${stderr}`;
      }

      return stdout || 'Code executed successfully with no output.';
    } catch (error) {
      return `Error executing code: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}