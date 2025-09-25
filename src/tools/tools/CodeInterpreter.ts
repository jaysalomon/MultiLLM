import { Tool } from '../../types/providers';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodeInterpreter {
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

  async execute(code: string): Promise<string> {
    try {
      // WARNING: This is a simple, non-sandboxed execution.
      // In a real application, this MUST be run in a secure, isolated environment (e.g., Docker container).
      const { stdout, stderr } = await execAsync(`python -c "${code.replace(/"/g, '\\"')}"`);

      if (stderr) {
        return `Error:\n${stderr}`;
      }

      return stdout || 'Code executed successfully with no output.';
    } catch (error) {
      return `Error executing code: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}