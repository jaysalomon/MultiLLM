/**
 * Unit tests for Logger utility
 * Tests logging functionality, levels, and formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, logger } from '../Logger';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn()
};

// Mock window and process for different environments
const mockWindow = {
  addEventListener: vi.fn(),
  electronAPI: {
    writeLog: vi.fn()
  }
};

const mockProcess = {
  on: vi.fn(),
  memoryUsage: vi.fn(() => ({
    rss: 1024 * 1024 * 100,
    heapTotal: 1024 * 1024 * 50,
    heapUsed: 1024 * 1024 * 30,
    external: 1024 * 1024 * 5
  }))
};

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    // Mock console
    vi.stubGlobal('console', mockConsole);
    
    // Reset mocks
    Object.values(mockConsole).forEach(mock => mock.mockClear());
    mockWindow.electronAPI.writeLog.mockClear();
    
    // Create fresh logger instance for each test
    testLogger = new Logger({
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableFile: false,
      enableRemote: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Log Levels', () => {
    it('should respect log level filtering', () => {
      const warnLogger = new Logger({ level: LogLevel.WARN });
      
      warnLogger.debug('debug message');
      warnLogger.info('info message');
      warnLogger.warn('warn message');
      warnLogger.error('error message');
      
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledWith(expect.stringContaining('warn message'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('error message'));
    });

    it('should log all levels when set to DEBUG', () => {
      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');
      
      expect(mockConsole.debug).toHaveBeenCalledWith(expect.stringContaining('debug message'));
      expect(mockConsole.info).toHaveBeenCalledWith(expect.stringContaining('info message'));
      expect(mockConsole.warn).toHaveBeenCalledWith(expect.stringContaining('warn message'));
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('error message'));
    });
  });

  describe('Message Formatting', () => {
    it('should format log messages with timestamp and level', () => {
      testLogger.info('test message');
      
      const logCall = mockConsole.info.mock.calls[0][0];
      expect(logCall).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(logCall).toContain('[INFO]');
      expect(logCall).toContain('test message');
    });

    it('should include context in log messages', () => {
      const context = { userId: '123', action: 'test' };
      testLogger.info('test message', context);
      
      const logCall = mockConsole.info.mock.calls[0][0];
      expect(logCall).toContain('Context: {"userId":"123","action":"test"}');
    });

    it('should include error information', () => {
      const error = new Error('Test error');
      testLogger.error('error occurred', {}, error);
      
      const logCall = mockConsole.error.mock.calls[0][0];
      expect(logCall).toContain('Error: Test error');
      expect(mockConsole.error).toHaveBeenCalledTimes(2); // Once for formatted message, once for error object
    });
  });

  describe('Category-specific Logging', () => {
    it('should log provider messages with correct category', () => {
      testLogger.provider(LogLevel.INFO, 'provider message');
      
      const logCall = mockConsole.info.mock.calls[0][0];
      expect(logCall).toContain('[PROVIDER]');
      expect(logCall).toContain('provider message');
    });

    it('should log database messages with correct category', () => {
      testLogger.database(LogLevel.ERROR, 'database error', {}, new Error('DB error'));
      
      const logCall = mockConsole.error.mock.calls[0][0];
      expect(logCall).toContain('[DATABASE]');
      expect(logCall).toContain('database error');
    });

    it('should log UI messages with correct category', () => {
      testLogger.ui(LogLevel.WARN, 'ui warning');
      
      const logCall = mockConsole.warn.mock.calls[0][0];
      expect(logCall).toContain('[UI]');
      expect(logCall).toContain('ui warning');
    });
  });

  describe('Log Buffer', () => {
    it('should maintain log buffer', () => {
      testLogger.info('message 1');
      testLogger.warn('message 2');
      testLogger.error('message 3');
      
      const buffer = testLogger.getLogBuffer();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].message).toBe('message 1');
      expect(buffer[1].message).toBe('message 2');
      expect(buffer[2].message).toBe('message 3');
    });

    it('should clear log buffer', () => {
      testLogger.info('message 1');
      testLogger.info('message 2');
      
      expect(testLogger.getLogBuffer()).toHaveLength(2);
      
      testLogger.clearLogBuffer();
      expect(testLogger.getLogBuffer()).toHaveLength(0);
    });

    it('should limit buffer size', () => {
      // Create logger with small buffer for testing
      const smallBufferLogger = new Logger({ level: LogLevel.DEBUG });
      
      // Add more messages than buffer size
      for (let i = 0; i < 1100; i++) {
        smallBufferLogger.info(`message ${i}`);
      }
      
      const buffer = smallBufferLogger.getLogBuffer();
      expect(buffer.length).toBeLessThanOrEqual(1000);
      expect(buffer[buffer.length - 1].message).toBe('message 1099');
    });
  });

  describe('Performance Utilities', () => {
    it('should handle timing operations', () => {
      testLogger.time('test-operation');
      expect(mockConsole.time).toHaveBeenCalledWith('test-operation');
      
      testLogger.timeEnd('test-operation');
      expect(mockConsole.timeEnd).toHaveBeenCalledWith('test-operation');
    });

    it('should log memory usage when available', () => {
      vi.stubGlobal('process', mockProcess);
      
      testLogger.logMemoryUsage();
      
      const logCall = mockConsole.info.mock.calls[0][0];
      expect(logCall).toContain('Memory Usage');
      expect(logCall).toContain('100 MB'); // rss
      expect(logCall).toContain('50 MB');  // heapTotal
      expect(logCall).toContain('30 MB');  // heapUsed
    });
  });

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const logger1 = new Logger();
      const logger2 = new Logger();
      
      expect(logger1.getSessionId()).not.toBe(logger2.getSessionId());
      expect(logger1.getSessionId()).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should include session ID in log entries', () => {
      testLogger.info('test message');
      
      const buffer = testLogger.getLogBuffer();
      expect(buffer[0].sessionId).toBe(testLogger.getSessionId());
    });
  });

  describe('Configuration', () => {
    it('should allow changing log level', () => {
      testLogger.setLogLevel(LogLevel.ERROR);
      
      testLogger.debug('debug message');
      testLogger.info('info message');
      testLogger.warn('warn message');
      testLogger.error('error message');
      
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('error message'));
    });

    it('should disable console logging when configured', () => {
      const noConsoleLogger = new Logger({ enableConsole: false });
      
      noConsoleLogger.info('test message');
      
      expect(mockConsole.info).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle file writing errors gracefully', async () => {
      vi.stubGlobal('window', {
        ...mockWindow,
        electronAPI: {
          writeLog: vi.fn().mockRejectedValue(new Error('File write failed'))
        }
      });
      
      const fileLogger = new Logger({ enableFile: true });
      
      // Should not throw
      expect(() => {
        fileLogger.info('test message');
      }).not.toThrow();
    });

    it('should handle remote logging errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const remoteLogger = new Logger({ 
        enableRemote: true, 
        remoteEndpoint: 'http://example.com/logs' 
      });
      
      // Should not throw
      expect(() => {
        remoteLogger.info('test message');
      }).not.toThrow();
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.stubGlobal('console', mockConsole);
    Object.values(mockConsole).forEach(mock => mock.mockClear());
  });

  it('should provide convenience logging functions', async () => {
    const { log, logger } = await import('../Logger');
    
    // Set logger to debug level to ensure all messages are logged
    logger.setLogLevel(0); // DEBUG level
    
    log.debug('debug message');
    log.info('info message');
    log.warn('warn message');
    log.error('error message');
    
    expect(mockConsole.debug).toHaveBeenCalled();
    expect(mockConsole.info).toHaveBeenCalled();
    expect(mockConsole.warn).toHaveBeenCalled();
    expect(mockConsole.error).toHaveBeenCalled();
  });

  it('should provide category-specific convenience functions', async () => {
    const { log } = await import('../Logger');
    
    log.provider.info('provider message');
    log.database.error('database error');
    log.ui.warn('ui warning');
    
    expect(mockConsole.info).toHaveBeenCalledWith(expect.stringContaining('[PROVIDER]'));
    expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[DATABASE]'));
    expect(mockConsole.warn).toHaveBeenCalledWith(expect.stringContaining('[UI]'));
  });
});