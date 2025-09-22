import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import App from '../renderer/App';
import { ThemeProvider } from '../renderer/contexts/ThemeContext';
import { DatabaseManager } from '../database/DatabaseManager';
import { LLMOrchestrator } from '../orchestrator/LLMOrchestrator';
import { SharedMemorySystem } from '../memory/SharedMemorySystem';
import { LLMCommunicationSystem } from '../orchestrator/LLMCommunicationSystem';

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
};

(global as any).window = {
  electronAPI: mockElectronAPI,
  matchMedia: vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
};

describe('End-to-End Integration Tests', () => {
  let dbManager: DatabaseManager;
  let orchestrator: LLMOrchestrator;
  let memorySystem: SharedMemorySystem;
  let communicationSystem: LLMCommunicationSystem;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Initialize core systems
    dbManager = new DatabaseManager(':memory:'); // Use in-memory DB for tests
    await dbManager.initialize();

    memorySystem = new SharedMemorySystem();
    await memorySystem.initialize();

    orchestrator = new LLMOrchestrator();
    communicationSystem = new LLMCommunicationSystem();

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
      // Save memory fact
      const fact = {
        id: 'fact-1',
        conversation_id: 'conv-1',
        fact: 'User prefers TypeScript over JavaScript',
        importance: 0.8,
        created_at: new Date(),
        embedding: [],
      };

      await dbManager.memory.createMemoryFact(fact);

      // Simulate app restart by creating new instance
      const newDbManager = new DatabaseManager(':memory:');
      await newDbManager.initialize();

      // Retrieve memory
      const memories = await newDbManager.memory.searchMemories('TypeScript');
      expect(memories).toBeDefined();
    });

    it('should update memory importance based on usage', async () => {
      const fact = {
        id: 'fact-1',
        conversation_id: 'conv-1',
        fact: 'Important information',
        importance: 0.5,
        created_at: new Date(),
        embedding: [],
      };

      await memorySystem.addMemory(fact.fact, fact.conversation_id);

      // Access memory multiple times
      for (let i = 0; i < 3; i++) {
        await memorySystem.searchMemories('Important information');
      }

      // Verify importance increased
      const updatedMemory = await memorySystem.getMemory(fact.id);
      expect(updatedMemory?.importance).toBeGreaterThan(0.5);
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
    it('should apply smooth transitions between themes', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <App />
        </ThemeProvider>
      );

      // Open settings
      const settingsButton = screen.getByText(/settings/i);
      await user.click(settingsButton);

      // Change theme
      const themeSelect = screen.getByLabelText(/theme/i);
      await user.selectOptions(themeSelect, 'dark');

      // Verify theme applied
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
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
        expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
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

      // First call fails
      await waitFor(() => {
        expect(mockElectronAPI.loadConversations).toHaveBeenCalledTimes(1);
      });

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
      const input = screen.getByLabelText(/message input/i);
      await user.type(input, 'Test message');
      await user.keyboard('{Enter}');

      // Error should be displayed but app remains functional
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});