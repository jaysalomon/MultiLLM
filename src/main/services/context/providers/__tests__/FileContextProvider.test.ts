import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileContextProvider } from '../FileContextProvider';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

// Mock mime-types
vi.mock('mime-types', () => ({
  lookup: vi.fn((filePath: string) => {
    if (filePath.endsWith('.ts')) return 'text/typescript';
    if (filePath.endsWith('.js')) return 'text/javascript';
    if (filePath.endsWith('.json')) return 'application/json';
    return 'text/plain';
  })
}));

describe('FileContextProvider', () => {
  let provider: FileContextProvider;

  beforeEach(() => {
    provider = new FileContextProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFile', () => {
    it('should successfully load a TypeScript file', async () => {
      const filePath = 'test.ts';
      const fileContent = `
import React from 'react';

export interface User {
  id: string;
  name: string;
}

export function getUserName(user: User): string {
  return user.name;
}
      `.trim();

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: fileContent.length
      } as any);

      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await provider.loadFile(filePath);

      expect(result.content).toContain('Key Code Elements:');
      expect(result.content).toContain('import React from \'react\'');
      expect(result.content).toContain('export interface User');
      expect(result.metadata.mimeType).toBe('text/typescript');
      expect(result.metadata.language).toBe('TypeScript');
      expect(result.metadata.size).toBe(fileContent.length);
      expect(result.metadata.tokens).toBeGreaterThan(0);
      expect(result.metadata.hash).toBeDefined();
    });

    it('should successfully load a JSON file', async () => {
      const filePath = 'package.json';
      const fileContent = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0'
        }
      }, null, 2);

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: fileContent.length
      } as any);

      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await provider.loadFile(filePath);

      expect(result.content).toContain(fileContent);
      expect(result.metadata.mimeType).toBe('application/json');
      expect(result.metadata.size).toBe(fileContent.length);
    });

    it('should throw error for non-existent file', async () => {
      const filePath = 'nonexistent.ts';
      
      mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(provider.loadFile(filePath)).rejects.toThrow();
    });

    it('should throw error for directory path', async () => {
      const filePath = 'src/';
      
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        size: 0
      } as any);

      await expect(provider.loadFile(filePath)).rejects.toThrow('Path is not a file');
    });

    it('should throw error for unsupported file type', async () => {
      const filePath = 'image.png';
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1000
      } as any);

      await expect(provider.loadFile(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('should throw error for file too large', async () => {
      const filePath = 'large.ts';
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 2 * 1024 * 1024 // 2MB
      } as any);

      await expect(provider.loadFile(filePath)).rejects.toThrow('File too large');
    });

    it('should extract important code elements from TypeScript file', async () => {
      const filePath = 'component.tsx';
      const fileContent = `
// This is a React component
import React, { useState } from 'react';

/**
 * User interface definition
 */
export interface UserProps {
  id: string;
  name: string;
}

// Component implementation
export const UserComponent: React.FC<UserProps> = ({ id, name }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  const handleClick = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div onClick={handleClick}>
      {isVisible && <span>{name}</span>}
    </div>
  );
};

export default UserComponent;
      `.trim();

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: fileContent.length
      } as any);

      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await provider.loadFile(filePath);

      expect(result.content).toContain('Key Code Elements:');
      expect(result.content).toContain('import React');
      expect(result.content).toContain('export interface UserProps');
      expect(result.content).toContain('export const UserComponent');
      expect(result.content).toContain('Documentation/Comments:');
      expect(result.content).toContain('/**');
    });

    it('should handle Python files correctly', async () => {
      const filePath = 'script.py';
      const fileContent = `
#!/usr/bin/env python3
"""
This is a Python script for data processing
"""

import pandas as pd
import numpy as np

def process_data(data):
    """Process the input data"""
    return data.dropna()

class DataProcessor:
    def __init__(self, config):
        self.config = config
    
    def run(self):
        pass

if __name__ == "__main__":
    processor = DataProcessor({})
    processor.run()
      `.trim();

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: fileContent.length
      } as any);

      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await provider.loadFile(filePath);

      expect(result.content).toContain('Key Code Elements:');
      expect(result.content).toContain('import pandas');
      expect(result.content).toContain('def process_data');
      expect(result.content).toContain('class DataProcessor');
      expect(result.metadata.language).toBe('Python');
    });

    it('should handle markdown files without code extraction', async () => {
      const filePath = 'README.md';
      const fileContent = `
# Project Title

This is a sample project.

## Features

- Feature 1
- Feature 2

## Installation

\`\`\`bash
npm install
\`\`\`
      `.trim();

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: fileContent.length
      } as any);

      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await provider.loadFile(filePath);

      // Markdown files should not go through code extraction
      expect(result.content).toBe(fileContent);
      expect(result.metadata.mimeType).toBe('text/plain');
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const filePath = 'test.ts';
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1000
      } as any);

      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(provider.loadFile(filePath)).rejects.toThrow('Permission denied');
    });

    it('should handle stat errors gracefully', async () => {
      const filePath = 'test.ts';
      
      mockFs.stat.mockRejectedValue(new Error('Access denied'));

      await expect(provider.loadFile(filePath)).rejects.toThrow('Access denied');
    });
  });

  describe('content processing', () => {
    it('should generate consistent hashes for same content', async () => {
      const filePath1 = 'test1.ts';
      const filePath2 = 'test2.ts';
      const sameContent = 'const x = 1;';

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: sameContent.length
      } as any);

      mockFs.readFile.mockResolvedValue(sameContent);

      const result1 = await provider.loadFile(filePath1);
      const result2 = await provider.loadFile(filePath2);

      expect(result1.metadata.hash).toBe(result2.metadata.hash);
    });

    it('should generate different hashes for different content', async () => {
      const filePath1 = 'test1.ts';
      const filePath2 = 'test2.ts';

      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 100
      } as any);

      mockFs.readFile
        .mockResolvedValueOnce('const x = 1;')
        .mockResolvedValueOnce('const y = 2;');

      const result1 = await provider.loadFile(filePath1);
      const result2 = await provider.loadFile(filePath2);

      expect(result1.metadata.hash).not.toBe(result2.metadata.hash);
    });
  });
});