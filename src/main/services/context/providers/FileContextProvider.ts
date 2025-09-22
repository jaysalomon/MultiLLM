import * as fs from 'fs/promises';
import * as path from 'path';
import * as mime from 'mime-types';
import { ContextMetadata } from '../../../../shared/types/context';
import { TokenCounter } from '../TokenCounter';

export class FileContextProvider {
  private tokenCounter: TokenCounter;
  private supportedExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json',
    '.py', '.java', '.cpp', '.c', '.h', '.rs', '.go',
    '.html', '.css', '.scss', '.less',
    '.md', '.txt', '.yml', '.yaml', '.toml',
    '.sh', '.bash', '.zsh', '.fish',
    '.sql', '.graphql', '.proto',
    '.vue', '.svelte', '.astro',
  ]);

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  async loadFile(filePath: string): Promise<{ content: string; metadata: ContextMetadata }> {
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Check if file is too large (> 1MB)
      if (stats.size > 1024 * 1024) {
        throw new Error(`File too large: ${filePath} (${stats.size} bytes)`);
      }

      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedExtensions.has(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const processedContent = this.processFileContent(content, ext);

      const metadata: ContextMetadata = {
        mimeType: mime.lookup(filePath) || 'text/plain',
        language: this.detectLanguage(ext) || undefined,
        encoding: 'utf-8',
        size: stats.size,
        hash: await this.hashContent(content),
        tokens: this.tokenCounter.count(processedContent),
      };

      return { content: processedContent, metadata };
    } catch (error) {
      console.error(`Failed to load file ${filePath}:`, error);
      throw error;
    }
  }

  private processFileContent(content: string, ext: string): string {
    let processed = content;

    // Add file type context
    const language = this.detectLanguage(ext);
    if (language) {
      processed = `Language: ${language}\n\n${processed}`;
    }

    // For code files, try to extract important parts
    if (this.isCodeFile(ext)) {
      processed = this.extractImportantCode(processed, ext);
    }

    return processed;
  }

  private extractImportantCode(content: string, ext: string): string {
    const lines = content.split('\n');
    const important: string[] = [];
    const context: string[] = [];

    // Patterns for important code elements
    const importantPatterns = [
      /^import\s+/,
      /^from\s+\S+\s+import/,
      /^export\s+/,
      /^class\s+/,
      /^interface\s+/,
      /^type\s+/,
      /^enum\s+/,
      /^function\s+/,
      /^const\s+/,
      /^let\s+/,
      /^var\s+/,
      /^def\s+/,
      /^async\s+/,
      /@api/,
      /@route/,
      /@deprecated/,
    ];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check if line matches important patterns
      const isImportant = importantPatterns.some(pattern => pattern.test(trimmed));
      
      if (isImportant) {
        // Include some context lines
        for (let i = Math.max(0, index - 1); i <= Math.min(lines.length - 1, index + 2); i++) {
          if (!important.includes(lines[i])) {
            important.push(lines[i]);
          }
        }
      }
      
      // Always include comments that might be documentation
      if (trimmed.startsWith('/**') || trimmed.startsWith('///') || trimmed.startsWith('#')) {
        context.push(line);
      }
    });

    // If we extracted important parts, combine them
    if (important.length > 0) {
      let result = 'Key Code Elements:\n';
      result += important.join('\n');
      
      if (context.length > 0) {
        result += '\n\nDocumentation/Comments:\n';
        result += context.join('\n');
      }
      
      // Add full content reference
      result += '\n\n[Full content available but condensed for context]';
      
      return result;
    }

    // Return original if no extraction performed
    return content;
  }

  private detectLanguage(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++ Header',
      '.rs': 'Rust',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.r': 'R',
      '.m': 'MATLAB',
      '.jl': 'Julia',
      '.lua': 'Lua',
      '.pl': 'Perl',
      '.sh': 'Shell',
      '.sql': 'SQL',
      '.graphql': 'GraphQL',
      '.proto': 'Protocol Buffers',
    };

    return languageMap[ext] || null;
  }

  private isCodeFile(ext: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.java', '.cpp', '.c', '.h',
      '.rs', '.go', '.rb', '.php',
      '.swift', '.kt', '.scala',
    ];
    return codeExtensions.includes(ext);
  }

  private async hashContent(content: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 16);
  }
}