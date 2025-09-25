import pdf from 'pdf-parse';

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
    '.pdf',
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

      let content: string;
      const buffer = await fs.readFile(filePath);

      if (ext === '.pdf') {
        const data = await pdf(buffer);
        content = data.text;
      } else {
        content = buffer.toString('utf-8');
      }

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
    // Process content based on file type
    if (['.json', '.yml', '.yaml'].includes(ext)) {
      // Pretty-print structured data
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    }

    // For code files, remove excessive comments but keep important ones
    if (['.ts', '.js', '.py', '.java'].includes(ext)) {
      // Simple comment removal (preserves JSDoc/docstrings)
      return content.replace(/\/\/[^\n]*$/gm, '').trim();
    }

    return content;
  }

  private detectLanguage(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rs': 'rust',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.m': 'matlab',
      '.sql': 'sql',
      '.sh': 'bash',
    };

    return languageMap[ext] || null;
  }

  private async hashContent(content: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}