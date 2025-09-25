import { Tool } from '../../types/providers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class FileOperations {
  private workingDirectory: string;

  constructor(workingDirectory?: string) {
    this.workingDirectory = workingDirectory || path.join(os.homedir(), 'MultiLLM', 'workspace');
  }

  getToolDefinition(): Tool {
    return {
      type: 'function',
      function: {
        name: 'file_operations',
        description: 'Perform file operations like read, write, list files in a sandboxed directory',
        parameters: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['read', 'write', 'list', 'delete', 'exists', 'mkdir'],
              description: 'The file operation to perform',
            },
            path: {
              type: 'string',
              description: 'Relative path within the workspace (sandboxed)',
            },
            content: {
              type: 'string',
              description: 'Content to write (only for write operation)',
            },
          },
          required: ['operation', 'path'],
        },
      },
    };
  }

  async execute(args: {
    operation: string;
    path: string;
    content?: string;
  }): Promise<string> {
    try {
      // Ensure working directory exists
      await this.ensureWorkingDirectory();

      // Sanitize and validate path
      const safePath = this.getSafePath(args.path);

      switch (args.operation) {
        case 'read':
          return await this.readFile(safePath);

        case 'write':
          if (!args.content) {
            return JSON.stringify({ error: 'Content is required for write operation' });
          }
          return await this.writeFile(safePath, args.content);

        case 'list':
          return await this.listFiles(safePath);

        case 'delete':
          return await this.deleteFile(safePath);

        case 'exists':
          return await this.checkExists(safePath);

        case 'mkdir':
          return await this.createDirectory(safePath);

        default:
          return JSON.stringify({ error: `Unknown operation: ${args.operation}` });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({ error: `File operation failed: ${errorMessage}` });
    }
  }

  private async ensureWorkingDirectory(): Promise<void> {
    try {
      await fs.access(this.workingDirectory);
    } catch {
      await fs.mkdir(this.workingDirectory, { recursive: true });
    }
  }

  private getSafePath(relativePath: string): string {
    // Normalize and resolve the path
    const normalized = path.normalize(relativePath);

    // Prevent directory traversal
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid path: Directory traversal or absolute paths not allowed');
    }

    return path.join(this.workingDirectory, normalized);
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.stringify({
        success: true,
        path: path.relative(this.workingDirectory, filePath),
        content,
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return JSON.stringify({ error: 'File not found' });
      }
      throw error;
    }
  }

  private async writeFile(filePath: string, content: string): Promise<string> {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, content, 'utf-8');
    const stats = await fs.stat(filePath);

    return JSON.stringify({
      success: true,
      path: path.relative(this.workingDirectory, filePath),
      size: stats.size,
    });
  }

  private async listFiles(dirPath: string): Promise<string> {
    try {
      const stats = await fs.stat(dirPath);

      if (!stats.isDirectory()) {
        return JSON.stringify({ error: 'Path is not a directory' });
      }

      const files = await fs.readdir(dirPath, { withFileTypes: true });
      const fileList = await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(dirPath, file.name);
          const stats = await fs.stat(fullPath);
          return {
            name: file.name,
            type: file.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        })
      );

      return JSON.stringify({
        success: true,
        path: path.relative(this.workingDirectory, dirPath),
        files: fileList,
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return JSON.stringify({ error: 'Directory not found' });
      }
      throw error;
    }
  }

  private async deleteFile(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }

      return JSON.stringify({
        success: true,
        path: path.relative(this.workingDirectory, filePath),
        message: 'File/directory deleted successfully',
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return JSON.stringify({ error: 'File not found' });
      }
      throw error;
    }
  }

  private async checkExists(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      return JSON.stringify({
        exists: true,
        path: path.relative(this.workingDirectory, filePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return JSON.stringify({
          exists: false,
          path: path.relative(this.workingDirectory, filePath),
        });
      }
      throw error;
    }
  }

  private async createDirectory(dirPath: string): Promise<string> {
    await fs.mkdir(dirPath, { recursive: true });
    return JSON.stringify({
      success: true,
      path: path.relative(this.workingDirectory, dirPath),
      message: 'Directory created successfully',
    });
  }
}