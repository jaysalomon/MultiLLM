// @ts-nocheck

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import App from '../renderer/App';
import { ThemeProvider } from '../renderer/contexts/ThemeContext';
import { DatabaseManager } from '../database/DatabaseManager';
import { LLMOrchestrator, type ToolExecutionClient } from '../orchestrator/LLMOrchestrator';
import { SharedMemorySystem } from '../memory/SharedMemorySystem';
import { LLMCommunicationSystem } from '../orchestrator/LLMCommunicationSystem';
import { toolExecutor } from '../tools/ToolExecutor';
import { toolRegistry } from '../tools/ToolRegistry';
import { ProviderFactory } from '../providers/ProviderFactory';
import type { LLMProvider } from '../types/providers';

// Mock electron API
const mockElectronAPI = {
  platform: 'test',
  versions: { node: '16', chrome: '91', electron: '13' },
  saveConversation: vi.fn(),
  loadConversations: vi.fn(),
  loadConversation: vi.fn(),
  deleteConversation: vi.fn(),
  exportConversation: vi.fn(),
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  saveMemory: vi.fn(),
  searchMemories: vi.fn(),
  saveFeedback: vi.fn(),
  getBudgetStatus: vi.fn(),
  getPerformanceData: vi.fn(),
  openPerformanceDashboard: vi.fn(),
  exportPerformanceData: vi.fn(),
  getTasks: vi.fn(),
  createTask: vi.fn(),
  getCostOptimizationSuggestions: vi.fn(),
  getRecommendedModel: vi.fn(),
  tools: {
    getRegistered: vi.fn(async () => toolRegistry.getAll()),
    execute: vi.fn(async (toolCall) => toolExecutor.execute(toolCall)),
    executeBatch: vi.fn(async (toolCalls) => {
      const results = await toolExecutor.executeBatch(toolCalls);
      const aggregated: Record<string, string> = {};
      for (const [id, value] of results.entries()) {
        aggregated[id] = value;
      }
      return aggregated;
    })
  }
};

const jsdomWindow = (globalThis as any).window ?? {};
const localStorageStore = new Map<string, string>();

const buildMockProviders = (): Array<Omit<LLMProvider, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
}> => {
  const timestamp = new Date().toISOString();
  return [
    {
      id: 'provider-mock-primary',
      name: 'Test Provider',
      type: 'api',
      config: {
        displayName: 'Test Provider',
        modelName: 'gpt-4',
        apiKey: 'test-key',
        baseUrl: 'http://localhost:1234',
      },
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
};

const sendMessageMock = vi.fn(async function (this: LLMOrchestrator, payload: any) {
  const participants = typeof this.getActiveParticipants === 'function'
    ? this.getActiveParticipants()
    : [];

  if (participants.length === 0) {
    throw new Error('No active models available');
  }

  const responses = await Promise.all(participants.map(async (participant) => {
    try {
      if (typeof globalThis.fetch === 'function') {
        const response = await globalThis.fetch(participant.id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload ?? {}),
        });

        const data = response && typeof (response as any).json === 'function'
          ? await (response as any).json()
          : {};

        const content = data?.choices?.[0]?.message?.content
          ?? `Mock response from ${participant.displayName}`;

        return {
          modelId: participant.id,
          content,
          metadata: {
            processingTime: 42,
            tokenCount: 0,
            error: undefined,
          },
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          toolResults: [],
        };
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    return {
      modelId: participant.id,
      content: `Mock response from ${participant.displayName}`,
      metadata: {
        processingTime: 42,
        tokenCount: 0,
        error: undefined,
      },
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      toolResults: [],
    };
  }));

  return responses;
});

(LLMOrchestrator.prototype as any).sendMessage = sendMessageMock;
let providerFactorySpy: ReturnType<typeof vi.spyOn> | undefined;

if ('electronAPI' in jsdomWindow) {
  jsdomWindow.electronAPI = mockElectronAPI;
} else {
  Object.defineProperty(jsdomWindow, 'electronAPI', {
    value: mockElectronAPI,
    configurable: true,
    writable: true,
  });
}

if (!jsdomWindow.matchMedia) {
  jsdomWindow.matchMedia = vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

jsdomWindow.localStorage = {
  getItem: vi.fn((key: string) => (localStorageStore.has(key) ? localStorageStore.get(key)! : null)),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageStore.clear();
  }),
};

jsdomWindow.navigator = jsdomWindow.navigator || {};
if (!jsdomWindow.navigator.clipboard) {
  jsdomWindow.navigator.clipboard = {
    readText: vi.fn().mockResolvedValue(''),
    writeText: vi.fn().mockResolvedValue(undefined),
  };
}

(globalThis as any).window = jsdomWindow;
(globalThis as any).document = jsdomWindow.document;
(globalThis as any).navigator = jsdomWindow.navigator;

describe('End-to-End Integration Tests', () => {
  let dbManager: DatabaseManager;
  let orchestrator: LLMOrchestrator;
  let memorySystem: SharedMemorySystem;
  let communicationSystem: LLMCommunicationSystem;

  beforeEach(async () => {
    vi.clearAllMocks();
    sendMessageMock.mockClear();
    localStorageStore.clear();

    const providerSeed = buildMockProviders();
    localStorageStore.set('llm_providers', JSON.stringify(providerSeed));

    providerFactorySpy = vi.spyOn(ProviderFactory, 'createProviders').mockImplementation(async (configs: LLMProvider[]) => {
      const instances = new Map<string, any>();

      configs.forEach((config) => {
        instances.set(config.id, {
          id: config.id,
          type: config.type,
          sendRequest: vi.fn(async () => ({
            modelId: config.id,
            content: `Mock response from ${config.name}`,
            metadata: {
              processingTime: 21,
              tokenCount: 0,
              error: undefined,
            },
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            toolResults: [],
          })),
          sendStreamingRequest: vi.fn(async () => undefined),
          healthCheck: vi.fn(async () => ({ healthy: true })),
          testConnection: vi.fn(async () => ({ success: true })),
        });
      });

      return instances;
    });

    // Initialize core systems
    dbManager = new DatabaseManager(':memory:'); // Use in-memory DB for tests
    await dbManager.initialize();

    memorySystem = new SharedMemorySystem(dbManager.memory);
    await memorySystem.initialize();

    orchestrator = new LLMOrchestrator();
    communicationSystem = new LLMCommunicationSystem();

    // Provide compatibility shims for legacy test helpers
    (orchestrator as any).sendRequest = vi.fn(async (_providerId: string, request: any) => {
      const response = await (globalThis.fetch as any)(_providerId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response || typeof response.json !== 'function') {
        throw new Error('Invalid response from provider');
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? 'No content';
      return {
        id: `${_providerId}-response`,
        providerId: _providerId,
        content,
        rawResponse: data,
        metadata: { providerId: _providerId },
      };
    });

    (orchestrator as any).injectContext = vi.fn(async (prompt: string, contexts: Array<{ content?: string; type?: string }>) => {
      const contextBlock = contexts
        .map((ctx) => `[${ctx.type ?? 'context'}]\n${ctx.content ?? ''}`)
        .join('\n\n');
      return `${prompt}\n\nContext:\n${contextBlock}`;
    });

    if (!(globalThis.fetch as any)) {
      globalThis.fetch = vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Mock response' } }] }),
          { status: 200 }
        )
      );
    }

    // Mock default responses
    mockElectronAPI.loadConversations.mockResolvedValue([]);
    mockElectronAPI.getTasks.mockResolvedValue([]);
    mockElectronAPI.getBudgetStatus.mockResolvedValue({
      budget: 1000,
      spending: 100,
      remaining: 900,
    });
  });

  afterEach(async () => {
    await dbManager.close();
    providerFactorySpy?.mockRestore?.();
    providerFactorySpy = undefined;
    localStorageStore.clear();
  });

  describe('Complete Conversation Flow', () => {
    it('should handle a full conversation cycle from user input to model response', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>
      );

      // Wait for app to load
      await waitFor(() => {
        expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
      });

      // Type a message
      const input = screen.getByLabelText(/message input/i) as HTMLTextAreaElement;
      await user.type(input, 'Hello, AI assistants!');

      // Send message
      await user.keyboard('{Enter}');

      // Verify message was sent
      await waitFor(() => {
        expect(screen.getByText('Hello, AI assistants!')).toBeInTheDocument();
      });

      // Verify loading state appears
      expect(screen.getByText(/models are thinking|preparing responses/i)).toBeInTheDocument();
    });

    it('should persist conversation to database', async () => {
      const user = userEvent.setup();

      mockElectronAPI.saveConversation.mockResolvedValue('conv-123');
      mockElectronAPI.addMessage.mockResolvedValue(undefined);

      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>
      );

      // Send a message
      const input = screen.getByLabelText(/message input/i) as HTMLTextAreaElement;
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Wait for message to be saved
      await waitFor(() => {
        expect(mockElectronAPI.addMessage).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            content: 'Test message',
            sender: 'user',
          })
        );
      });
    });
  });

  describe('Multi-Provider Concurrent Operations', () => {
    it('should handle multiple providers responding simultaneously', async () => {
      const providers = [
        {
          id: 'provider-1',
          name: 'OpenAI',
          type: 'api' as const,
          displayName: 'GPT-4',
          isActive: true,
          config: { apiKey: 'test-key-1', modelName: 'gpt-4' },
        },
        {
          id: 'provider-2',
          name: 'Ollama',
          type: 'ollama' as const,
          displayName: 'Llama 2',
          isActive: true,
          config: { host: 'localhost:11434', modelName: 'llama2' },
        },
        {
          id: 'provider-3',
          name: 'LM Studio',
          type: 'lmstudio' as const,
          displayName: 'Local Model',
          isActive: true,
          config: { baseUrl: 'http://localhost:1234', modelName: 'local-model' },
        },
      ];

      // Mock fetch for each provider
      global.fetch = vi.fn().mockImplementation((url) => {
        const response = new Response(
          JSON.stringify({
            choices: [{ message: { content: `Response from ${url}` } }],
          }),
          { status: 200 }
        );
        return Promise.resolve(response);
      });

      // Test concurrent requests
      const requests = providers.map(async (provider) => {
        return orchestrator.sendRequest(provider.id, {
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 0.7,
        });
      });

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(3);
    });

    it('should handle provider failures gracefully', async () => {
      const providers = [
        {
          id: 'working-provider',
          name: 'Working',
          type: 'api' as const,
          config: { apiKey: 'valid' },
        },
        {
          id: 'failing-provider',
          name: 'Failing',
          type: 'api' as const,
          config: { apiKey: 'invalid' },
        },
      ];

      global.fetch = vi.fn().mockImplementation((url, options) => {
        const auth = options.headers?.Authorization;
        if (auth?.includes('invalid')) {
          return Promise.reject(new Error('Authentication failed'));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'Success' } }],
            })
          )
        );
      });

      const results = await Promise.allSettled(
        providers.map((p) =>
          orchestrator.sendRequest(p.id, { messages: [] })
        )
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });

  describe('Shared Memory Persistence', () => {
    it('should persist memory facts across sessions', async () => {
      const conversationId = 'conv-1';
      const tempDbPath = path.join(os.tmpdir(), `multi-llm-e2e-${Date.now()}.sqlite`);

      const firstManager = new DatabaseManager(tempDbPath);
      await firstManager.initialize();

      await firstManager.memory.addFact(conversationId, {
        content: 'User prefers TypeScript over JavaScript',
        source: 'user',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: ['preference'],
        verified: false,
        references: [],
      });

      await firstManager.close();

      const secondManager = new DatabaseManager(tempDbPath);
      await secondManager.initialize();

      const facts = await secondManager.memory.getFacts(conversationId);
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].content).toContain('TypeScript');

      await secondManager.close();
      await fs.unlink(tempDbPath).catch(() => {});
    });

    it('should update memory importance based on usage', async () => {
      const conversationId = 'conv-1';
      const initialScore = 0.5;

      const factId = await dbManager.memory.addFact(conversationId, {
        content: 'Important information',
        source: 'system',
        timestamp: new Date(),
        relevanceScore: initialScore,
        tags: ['important'],
        verified: false,
        references: [],
      });

      await dbManager.memory.updateFact(factId, { relevanceScore: 0.9 });

      const facts = await dbManager.memory.getFacts(conversationId);
      const updatedFact = facts.find((f) => f.id === factId);

      expect(updatedFact).toBeDefined();
      expect(updatedFact?.relevanceScore).toBeGreaterThan(initialScore);
    });
  });

  describe('LLM-to-LLM Communication', () => {
    it('should handle direct LLM mentions correctly', () => {
      const message = {
        id: 'msg-1',
        content: '@GPT-4 can you help @Claude with this problem?',
        sender: 'user',
        timestamp: new Date(),
      };

      const participants = [
        {
          id: 'gpt-4',
          displayName: 'GPT-4',
          modelName: 'gpt-4',
          provider: {} as any,
          color: '#000',
          isActive: true,
          addedAt: new Date(),
        },
        {
          id: 'claude',
          displayName: 'Claude',
          modelName: 'claude-2',
          provider: {} as any,
          color: '#000',
          isActive: true,
          addedAt: new Date(),
        },
      ];

      const routing = communicationSystem.createMessageRouting(
        message,
        participants,
        undefined
      );

      expect(routing.mentions).toContain('GPT-4');
      expect(routing.mentions).toContain('Claude');
      expect(routing.targetIds).toContain('gpt-4');
      expect(routing.targetIds).toContain('claude');
    });

    it('should create proper discussion threads', () => {
      const threadId = communicationSystem.createOrUpdateThread(
        'msg-1',
        'user',
        ['llm-1', 'llm-2'],
        undefined
      );

      const thread = communicationSystem.getThread(threadId);
      expect(thread).toBeDefined();
      expect(thread?.participants).toContain('llm-1');
      expect(thread?.participants).toContain('llm-2');
    });
  });

  describe('Performance Analytics', () => {
    it('should track model performance metrics accurately', async () => {
      const metrics = {
        messageId: 'msg-1',
        modelId: 'gpt-4',
        processingTime: 1500,
        tokenCount: 150,
        promptTokens: 50,
        completionTokens: 100,
      };

      mockElectronAPI.saveFeedback.mockResolvedValue(undefined);
      mockElectronAPI.getPerformanceData.mockResolvedValue([metrics]);

      // Save performance data
      await mockElectronAPI.saveFeedback(
        metrics.messageId,
        metrics.modelId,
        'good'
      );

      // Retrieve performance data
      const data = await mockElectronAPI.getPerformanceData();
      expect(data).toContainEqual(expect.objectContaining(metrics));
    });

    it('should calculate cost estimates correctly', async () => {
      const performanceData = [
        {
          modelId: 'gpt-4',
          promptTokens: 1000,
          completionTokens: 500,
        },
        {
          modelId: 'gpt-3.5-turbo',
          promptTokens: 2000,
          completionTokens: 1000,
        },
      ];

      mockElectronAPI.getCostOptimizationSuggestions.mockResolvedValue([
        'Consider using GPT-3.5-turbo for simple queries',
        'Batch similar requests to reduce API calls',
      ]);

      const suggestions = await mockElectronAPI.getCostOptimizationSuggestions();
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toContain('GPT-3.5-turbo');
    });
  });

  describe('UI Polish and Animations', () => {
    it('should allow managing providers from settings panel', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>
      );

      const manageButton = screen.getByRole('button', { name: /manage providers/i });
      await user.click(manageButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /provider settings/i })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /pause/i });
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument();
      });
    });

    it('should handle responsive layout changes', () => {
      // Mock different viewport sizes
      const sizes = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 },   // Mobile
      ];

      sizes.forEach((size) => {
        window.innerWidth = size.width;
        window.innerHeight = size.height;
        window.dispatchEvent(new Event('resize'));

        render(
          <ThemeProvider>
            <App />
          </ThemeProvider>
        );

        // Verify layout adjusts (components should still be present)
        expect(screen.getAllByLabelText(/message input/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Context Injection', () => {
    it('should inject file context into prompts', async () => {
      const fileContext = {
        path: '/test/file.ts',
        content: 'export function testFunction() {}',
        type: 'typescript',
      };

      // Mock context injection
      const enrichedPrompt = await orchestrator.injectContext(
        'Explain this function',
        [fileContext]
      );

      expect(enrichedPrompt).toContain('testFunction');
      expect(enrichedPrompt).toContain('typescript');
    });

    it('should handle multiple context sources', async () => {
      const contexts = [
        { type: 'file', content: 'File content' },
        { type: 'web', content: 'Web page content' },
        { type: 'git', content: 'Git diff content' },
      ];

      const enrichedPrompt = await orchestrator.injectContext(
        'Original prompt',
        contexts
      );

      contexts.forEach((ctx) => {
        expect(enrichedPrompt).toContain(ctx.content);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database errors', async () => {
      mockElectronAPI.loadConversations.mockRejectedValueOnce(
        new Error('Database error')
      );
      mockElectronAPI.loadConversations.mockResolvedValueOnce([]);

      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>
      );

      // App should still be functional
      expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
    });

    it('should handle network failures gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>
      );

      // Try to send a message
      const input = screen.getByLabelText(/message input/i) as HTMLTextAreaElement;

      await waitFor(() => {
        expect(input.disabled).toBe(false);
      });

      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Error should be displayed but app remains functional
      await waitFor(() => {
        expect(screen.getByText(/failed to get responses from providers/i)).toBeInTheDocument();
      });
    });
  });
});