/**
 * Unit tests for ErrorReporter utility
 * Tests error reporting, breadcrumbs, and system information collection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorReporter, errorReporter } from '../ErrorReporter';

// Mock dependencies
const mockLogger = {
  error: vi.fn(),
  getSessionId: vi.fn(() => 'test-session-123')
};

const mockWindow = {
  location: { href: 'http://localhost:3000/test' },
  electronAPI: {
    storeErrorReport: vi.fn(),
    getStoredErrorReports: vi.fn(),
    clearStoredErrorReports: vi.fn()
  }
};

const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)'
};

const mockScreen = {
  width: 1920,
  height: 1080
};

const mockPerformance = {
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024
  }
};

const mockProcess = {
  platform: 'darwin',
  arch: 'x64',
  version: 'v18.0.0',
  memoryUsage: vi.fn(() => ({
    rss: 100 * 1024 * 1024,
    heapTotal: 50 * 1024 * 1024,
    heapUsed: 30 * 1024 * 1024,
    external: 5 * 1024 * 1024
  }))
};

describe('ErrorReporter', () => {
  let testReporter: ErrorReporter;

  beforeEach(() => {
    // Mock global objects
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('screen', mockScreen);
    vi.stubGlobal('performance', mockPerformance);
    vi.stubGlobal('process', mockProcess);
    
    // Mock fetch
    global.fetch = vi.fn();
    
    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
    
    // Reset mocks
    mockLogger.error.mockClear();
    mockWindow.electronAPI.storeErrorReport.mockClear();
    mockWindow.electronAPI.getStoredErrorReports.mockClear();
    mockWindow.electronAPI.clearStoredErrorReports.mockClear();
    (global.fetch as any).mockClear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    
    // Create fresh reporter instance
    testReporter = new ErrorReporter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Breadcrumb Management', () => {
    it('should add breadcrumbs', () => {
      testReporter.addBreadcrumb({
        category: 'user_action',
        message: 'Button clicked',
        level: 'info',
        data: { buttonId: 'submit' }
      });

      const breadcrumbs = testReporter.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(1);
      expect(breadcrumbs[0]).toMatchObject({
        category: 'user_action',
        message: 'Button clicked',
        level: 'info',
        data: { buttonId: 'submit' }
      });
      expect(breadcrumbs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should limit breadcrumb count', () => {
      // Add more breadcrumbs than the limit
      for (let i = 0; i < 60; i++) {
        testReporter.addBreadcrumb({
          category: 'test',
          message: `Message ${i}`,
          level: 'info'
        });
      }

      const breadcrumbs = testReporter.getBreadcrumbs();
      expect(breadcrumbs.length).toBeLessThanOrEqual(50);
      expect(breadcrumbs[breadcrumbs.length - 1].message).toBe('Message 59');
    });

    it('should clear breadcrumbs', () => {
      testReporter.addBreadcrumb({
        category: 'test',
        message: 'Test message',
        level: 'info'
      });

      expect(testReporter.getBreadcrumbs()).toHaveLength(1);
      
      testReporter.clearBreadcrumbs();
      expect(testReporter.getBreadcrumbs()).toHaveLength(0);
    });
  });

  describe('Error Severity Determination', () => {
    it('should classify TypeError as critical', async () => {
      const error = new TypeError('Cannot read property of undefined');
      
      await testReporter.reportError(error, {
        component: 'TestComponent'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical'
        })
      );
    });

    it('should classify ReferenceError as critical', async () => {
      const error = new ReferenceError('Variable is not defined');
      
      await testReporter.reportError(error, {
        component: 'TestComponent'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical'
        })
      );
    });

    it('should classify provider errors as high severity', async () => {
      const error = new Error('Provider connection failed');
      
      await testReporter.reportError(error, {
        component: 'APIProvider'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'high'
        })
      );
    });

    it('should classify UI errors as medium severity', async () => {
      const error = new Error('Component render failed');
      
      await testReporter.reportError(error, {
        component: 'UIComponent'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Categorization', () => {
    it('should categorize provider errors', async () => {
      const error = new Error('API request failed');
      
      await testReporter.reportError(error, {
        component: 'APIProvider'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'provider'
        })
      );
    });

    it('should categorize database errors', async () => {
      const error = new Error('Database query failed');
      
      await testReporter.reportError(error, {
        component: 'DatabaseManager'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'database'
        })
      );
    });

    it('should categorize network errors', async () => {
      const error = new Error('fetch failed');
      error.name = 'NetworkError';
      
      await testReporter.reportError(error);

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'network'
        })
      );
    });
  });

  describe('Tag Generation', () => {
    it('should generate appropriate tags', async () => {
      const error = new TypeError('Test error');
      
      await testReporter.reportError(error, {
        component: 'TestComponent',
        action: 'buttonClick'
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining([
            'component:testcomponent',
            'action:buttonclick',
            'error:typeerror',
            'platform:renderer'
          ])
        })
      );
    });
  });

  describe('System Information Collection', () => {
    it('should collect renderer process system info', async () => {
      const error = new Error('Test error');
      
      await testReporter.reportError(error);

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInfo: expect.objectContaining({
            platform: 'renderer',
            userAgent: 'Mozilla/5.0 (Test Browser)',
            screen: { width: 1920, height: 1080 },
            memory: {
              used: 50 * 1024 * 1024,
              total: 100 * 1024 * 1024
            }
          })
        })
      );
    });

    it('should collect main process system info', async () => {
      // Remove window to simulate main process
      vi.stubGlobal('window', undefined);
      
      const mainReporter = new ErrorReporter();
      const error = new Error('Test error');
      
      await mainReporter.reportError(error);

      // Should use localStorage fallback
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Error Report Structure', () => {
    it('should create complete error reports', async () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      testReporter.addBreadcrumb({
        category: 'user_action',
        message: 'User clicked button',
        level: 'info'
      });

      await testReporter.reportError(error, {
        component: 'TestComponent',
        action: 'test_action',
        additionalData: { testData: 'value' }
      });

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^error_\d+_[a-z0-9]+$/),
          timestamp: expect.any(Date),
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
            stack: expect.stringContaining('Error: Test error')
          }),
          context: expect.objectContaining({
            component: 'TestComponent',
            action: 'test_action',
            additionalData: { testData: 'value' }
          }),
          userAgent: 'Mozilla/5.0 (Test Browser)',
          url: 'http://localhost:3000/test',
          sessionId: 'test-session-123',
          severity: expect.any(String),
          category: expect.any(String),
          tags: expect.any(Array),
          breadcrumbs: expect.arrayContaining([
            expect.objectContaining({
              category: 'user_action',
              message: 'User clicked button'
            })
          ]),
          systemInfo: expect.any(Object)
        })
      );
    });
  });

  describe('Storage Operations', () => {
    it('should store error reports locally', async () => {
      const error = new Error('Test error');
      
      await testReporter.reportError(error);

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error'
          })
        })
      );
    });

    it('should fallback to localStorage when electronAPI unavailable', async () => {
      vi.stubGlobal('window', { location: { href: 'test' } });
      localStorage.getItem.mockReturnValue('[]');
      
      const fallbackReporter = new ErrorReporter();
      const error = new Error('Test error');
      
      await fallbackReporter.reportError(error);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'errorReports',
        expect.stringContaining('Test error')
      );
    });

    it('should retrieve stored error reports', async () => {
      const mockReports = [
        { id: 'error1', message: 'Error 1' },
        { id: 'error2', message: 'Error 2' }
      ];
      
      mockWindow.electronAPI.getStoredErrorReports.mockResolvedValue(mockReports);
      
      const reports = await testReporter.getStoredReports();
      
      expect(reports).toEqual(mockReports);
      expect(mockWindow.electronAPI.getStoredErrorReports).toHaveBeenCalled();
    });

    it('should clear stored error reports', async () => {
      await testReporter.clearStoredReports();
      
      expect(mockWindow.electronAPI.clearStoredErrorReports).toHaveBeenCalled();
    });
  });

  describe('Remote Reporting', () => {
    it('should send reports to remote endpoint when configured', async () => {
      const endpoint = 'https://api.example.com/errors';
      testReporter.setReportingEndpoint(endpoint);
      
      (global.fetch as any).mockResolvedValue({ ok: true });
      
      const error = new Error('Test error');
      await testReporter.reportError(error);

      expect(global.fetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test error')
        })
      );
    });

    it('should handle remote reporting failures gracefully', async () => {
      testReporter.setReportingEndpoint('https://api.example.com/errors');
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const error = new Error('Test error');
      
      // Should not throw
      await expect(testReporter.reportError(error)).resolves.not.toThrow();
    });
  });

  describe('Performance Issue Reporting', () => {
    it('should report performance issues', async () => {
      const metrics = {
        responseTime: 5000,
        memoryUsage: 95
      };

      await testReporter.reportPerformanceIssue(
        'Slow response time detected',
        metrics,
        { component: 'APIProvider' }
      );

      expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'PerformanceError',
            message: 'Slow response time detected'
          }),
          context: expect.objectContaining({
            component: 'APIProvider',
            additionalData: expect.objectContaining({
              metrics
            })
          })
        })
      );
    });
  });

  describe('Configuration', () => {
    it('should allow enabling/disabling reporting', async () => {
      testReporter.setEnabled(false);
      
      const error = new Error('Test error');
      await testReporter.reportError(error);

      expect(mockWindow.electronAPI.storeErrorReport).not.toHaveBeenCalled();
    });

    it('should allow setting reporting endpoint', () => {
      const endpoint = 'https://api.example.com/errors';
      testReporter.setReportingEndpoint(endpoint);
      
      // Endpoint should be used in next report
      expect(() => testReporter.setReportingEndpoint(endpoint)).not.toThrow();
    });
  });
});

describe('Convenience Functions', () => {
  beforeEach(() => {
    vi.stubGlobal('window', mockWindow);
    mockWindow.electronAPI.storeErrorReport.mockClear();
  });

  it('should provide reportError convenience function', async () => {
    const { reportError } = await import('../ErrorReporter');
    const error = new Error('Test error');
    
    await reportError(error, { component: 'TestComponent' });
    
    expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalled();
  });

  it('should provide reportHandledError convenience function', async () => {
    const { reportHandledError } = await import('../ErrorReporter');
    const error = new Error('Test error');
    
    await reportHandledError(error, 'TestComponent', 'test_action', { data: 'test' });
    
    expect(mockWindow.electronAPI.storeErrorReport).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          component: 'TestComponent',
          action: 'test_action',
          additionalData: { data: 'test' }
        })
      })
    );
  });

  it('should provide addBreadcrumb convenience function', () => {
    const { addBreadcrumb } = require('../ErrorReporter');
    
    expect(() => {
      addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info'
      });
    }).not.toThrow();
  });
});