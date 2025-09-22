import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ContextMetadata } from '../../../../shared/types/context';
import { TokenCounter } from '../TokenCounter';

const execAsync = promisify(exec);

export class GitContextProvider {
  private tokenCounter: TokenCounter;

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  async getRepoContext(repoPath: string): Promise<{ content: string; metadata: ContextMetadata }> {
    try {
      // Check if path is a git repository
      await execAsync('git rev-parse --git-dir', { cwd: repoPath });

      // Get current branch
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
      
      // Get current commit
      const { stdout: commit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });

      // Get repository structure
      const structure = await this.getRepoStructure(repoPath);
      
      // Get recent commits
      const recentCommits = await this.getRecentCommits(repoPath, 10);
      
      // Get modified files
      const modifiedFiles = await this.getModifiedFiles(repoPath);

      // Get README content if exists
      const readme = await this.getReadme(repoPath);

      // Combine all context
      let content = `Git Repository: ${repoPath}\n`;
      content += `Branch: ${branch.trim()}\n`;
      content += `Commit: ${commit.trim()}\n\n`;

      if (readme) {
        content += `README:\n${readme}\n\n`;
      }

      content += `Repository Structure:\n${structure}\n\n`;
      
      if (modifiedFiles.length > 0) {
        content += `Modified Files:\n`;
        modifiedFiles.forEach(file => content += `- ${file}\n`);
        content += '\n';
      }

      content += `Recent Commits:\n${recentCommits}\n`;

      const metadata: ContextMetadata = {
        gitBranch: branch.trim(),
        gitCommit: commit.trim(),
        tokens: this.tokenCounter.count(content),
      };

      return { content, metadata };
    } catch (error) {
      console.error(`Failed to get git context for ${repoPath}:`, error);
      throw error;
    }
  }

  private async getRepoStructure(repoPath: string): Promise<string> {
    try {
      // Get tree structure, excluding common ignored directories
      const { stdout } = await execAsync(
        'git ls-tree -r --name-only HEAD | head -100',
        { cwd: repoPath }
      );

      const files = stdout.split('\n').filter(f => f.trim());
      const structure = this.buildTreeStructure(files);
      return this.formatTreeStructure(structure);
    } catch {
      return 'Unable to retrieve repository structure';
    }
  }

  private buildTreeStructure(files: string[]): any {
    const tree: any = {};
    
    files.forEach(file => {
      const parts = file.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          if (!current._files) current._files = [];
          current._files.push(part);
        } else {
          // It's a directory
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });
    
    return tree;
  }

  private formatTreeStructure(tree: any, indent = ''): string {
    let result = '';
    
    // Format directories
    Object.keys(tree).forEach(key => {
      if (key !== '_files') {
        result += `${indent}📁 ${key}/\n`;
        result += this.formatTreeStructure(tree[key], indent + '  ');
      }
    });
    
    // Format files
    if (tree._files) {
      tree._files.forEach((file: string) => {
        const ext = path.extname(file);
        const icon = this.getFileIcon(ext);
        result += `${indent}${icon} ${file}\n`;
      });
    }
    
    return result;
  }

  private getFileIcon(ext: string): string {
    const icons: Record<string, string> = {
      '.ts': '📘',
      '.tsx': '📘',
      '.js': '📜',
      '.jsx': '📜',
      '.json': '📋',
      '.md': '📝',
      '.css': '🎨',
      '.html': '🌐',
      '.py': '🐍',
      '.go': '🐹',
      '.rs': '🦀',
      '.java': '☕',
      '.cpp': '⚙️',
      '.c': '⚙️',
      '.h': '📄',
      '.yml': '⚙️',
      '.yaml': '⚙️',
    };
    
    return icons[ext] || '📄';
  }

  private async getRecentCommits(repoPath: string, limit: number): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `git log --oneline -${limit}`,
        { cwd: repoPath }
      );
      return stdout;
    } catch {
      return 'No recent commits available';
    }
  }

  private async getModifiedFiles(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath });
      return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3));
    } catch {
      return [];
    }
  }

  private async getReadme(repoPath: string): Promise<string | null> {
    const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'README'];
    
    for (const filename of readmeFiles) {
      try {
        const readmePath = path.join(repoPath, filename);
        const content = await fs.readFile(readmePath, 'utf-8');
        // Return first 1000 characters of README
        return content.substring(0, 1000) + (content.length > 1000 ? '...' : '');
      } catch {
        // Continue to next potential README file
      }
    }
    
    return null;
  }
}