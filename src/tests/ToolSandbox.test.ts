import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ToolSandbox } from '../tools/sandbox/ToolSandbox';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ToolSandbox', () => {
  let sandbox: ToolSandbox;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `sandbox-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    sandbox = new ToolSandbox({
      timeout: 5000,
      memoryLimit: 64 * 1024 * 1024,
      tempDirectory: tempDir,
    });

    await sandbox.initialize();
  });

  afterEach(async () => {
    await sandbox.cleanup();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('VM execution', () => {
    it('should execute safe code in VM', async () => {
      const code = `
        const result = 2 + 2;
        result;
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(true);
      expect(result.output).toBe(4);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should provide safe globals', async () => {
      const code = `
        const arr = [1, 2, 3];
        const doubled = arr.map(x => x * 2);
        JSON.stringify(doubled);
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(true);
      expect(result.output).toBe('[2,4,6]');
    });

    it('should block dangerous globals', async () => {
      const dangerousCode = [
        'process.exit(1)',
        'require("fs")',
        'eval("malicious code")',
        'Function("return this")()',
      ];

      for (const code of dangerousCode) {
        const result = await sandbox.executeInVM(code);
        expect(result.success).toBe(false);
        expect(result.error).toContain('not allowed');
      }
    });

    it('should respect timeout', async () => {
      const code = `
        while (true) {
          // Infinite loop
        }
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle user context', async () => {
      const code = `
        const result = customFunction(5);
        result;
      `;

      const context = {
        customFunction: (n: number) => n * 2,
      };

      const result = await sandbox.executeInVM(code, context);

      expect(result.success).toBe(true);
      expect(result.output).toBe(10);
    });

    it('should handle errors gracefully', async () => {
      const code = `
        throw new Error('Test error');
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });
  });

  describe('File system restrictions', () => {
    it('should allow access to permitted paths', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const toolFunction = async (context: any) => {
        return await context.fs.readFile(testFile, 'utf-8');
      };

      const result = await sandbox.executeWithFileSystemRestrictions(
        toolFunction,
        { path: testFile },
        [tempDir]
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('test content');
    });

    it('should block access to restricted paths', async () => {
      const restrictedFile = '/etc/passwd';

      const toolFunction = async (context: any) => {
        return await context.fs.readFile(restrictedFile, 'utf-8');
      };

      const result = await sandbox.executeWithFileSystemRestrictions(
        toolFunction,
        { path: restrictedFile },
        [tempDir]
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('should prevent directory traversal', async () => {
      const maliciousPath = path.join(tempDir, '..', '..', 'etc', 'passwd');

      const toolFunction = async (context: any) => {
        return await context.fs.readFile(maliciousPath, 'utf-8');
      };

      const result = await sandbox.executeWithFileSystemRestrictions(
        toolFunction,
        { path: maliciousPath },
        [tempDir]
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('should enforce file size limits', async () => {
      const largeFile = path.join(tempDir, 'large.txt');
      const largeContent = 'A'.repeat(11 * 1024 * 1024); // 11MB
      await fs.writeFile(largeFile, largeContent);

      const toolFunction = async (context: any) => {
        return await context.fs.readFile(largeFile, 'utf-8');
      };

      const result = await sandbox.executeWithFileSystemRestrictions(
        toolFunction,
        { path: largeFile },
        [tempDir]
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should allow file writing in permitted paths', async () => {
      const outputFile = path.join(tempDir, 'output.txt');

      const toolFunction = async (context: any) => {
        await context.fs.writeFile(outputFile, 'written content', 'utf-8');
        return 'success';
      };

      const result = await sandbox.executeWithFileSystemRestrictions(
        toolFunction,
        { path: outputFile },
        [tempDir]
      );

      expect(result.success).toBe(true);

      const written = await fs.readFile(outputFile, 'utf-8');
      expect(written).toBe('written content');
    });
  });

  describe('Worker execution', () => {
    it('should execute code in worker thread', async () => {
      // Create a simple worker script
      const workerScript = path.join(tempDir, 'worker.js');
      const workerCode = `
        const { parentPort, workerData } = require('worker_threads');
        const result = workerData.value * 2;
        parentPort.postMessage(result);
      `;
      await fs.writeFile(workerScript, workerCode);

      const result = await sandbox.executeInWorker(
        workerScript,
        { value: 5 },
        'test-worker'
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe(10);
    });

    it('should respect worker timeout', async () => {
      const workerScript = path.join(tempDir, 'slow-worker.js');
      const workerCode = `
        const { parentPort } = require('worker_threads');
        setTimeout(() => {
          parentPort.postMessage('done');
        }, 10000);
      `;
      await fs.writeFile(workerScript, workerCode);

      const fastSandbox = new ToolSandbox({ timeout: 100 });
      await fastSandbox.initialize();

      const result = await fastSandbox.executeInWorker(
        workerScript,
        {},
        'timeout-worker'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');

      await fastSandbox.cleanup();
    });

    it('should handle worker errors', async () => {
      const workerScript = path.join(tempDir, 'error-worker.js');
      const workerCode = `
        throw new Error('Worker error');
      `;
      await fs.writeFile(workerScript, workerCode);

      const result = await sandbox.executeInWorker(
        workerScript,
        {},
        'error-worker'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Worker stopped');
    });
  });

  describe('Sandbox context', () => {
    it('should provide safe console methods', async () => {
      const logs: any[] = [];
      jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args);
      });

      const code = `
        console.log('test message');
        'done';
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(true);
      expect(result.output).toBe('done');
    });

    it('should provide restricted Date object', async () => {
      const code = `
        const now1 = Date.now();
        const now2 = Date.now();
        now2 >= now1;
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(true);
      expect(typeof result.output).toBe('boolean');
    });

    it('should allow safe Object methods', async () => {
      const code = `
        const obj = { a: 1, b: 2 };
        const keys = Object.keys(obj);
        const values = Object.values(obj);
        JSON.stringify({ keys, values });
      `;

      const result = await sandbox.executeInVM(code);

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output);
      expect(parsed.keys).toEqual(['a', 'b']);
      expect(parsed.values).toEqual([1, 2]);
    });
  });

  describe('Statistics and cleanup', () => {
    it('should provide sandbox statistics', () => {
      const stats = sandbox.getStats();

      expect(stats).toBeDefined();
      expect(stats.tempDirectory).toBe(tempDir);
      expect(stats.activeWorkers).toBe(0);
      expect(stats.config).toBeDefined();
    });

    it('should clean up resources', async () => {
      const workerScript = path.join(tempDir, 'cleanup-worker.js');
      const workerCode = `
        const { parentPort } = require('worker_threads');
        setTimeout(() => parentPort.postMessage('done'), 100);
      `;
      await fs.writeFile(workerScript, workerCode);

      // Start worker but don't wait
      sandbox.executeInWorker(workerScript, {}, 'cleanup-test');

      // Check active workers
      let stats = sandbox.getStats();
      expect(stats.activeWorkers).toBeGreaterThan(0);

      // Clean up
      await sandbox.cleanup();

      stats = sandbox.getStats();
      expect(stats.activeWorkers).toBe(0);
    });
  });
});