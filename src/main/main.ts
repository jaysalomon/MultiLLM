import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseManager } from '../database/DatabaseManager';
import { QualityFeedbackRepository } from '../database/QualityFeedbackRepository';
import { PerformanceRepository } from '../database/PerformanceRepository';
import { PerformanceService } from '../services/PerformanceService';
import { CostService } from '../services/CostService';
import { BudgetService } from '../services/BudgetService';
import { TaskRepository } from '../database/TaskRepository';
import { errorLoggingSystem } from '../utils/ErrorLoggingSystem';
import { logger } from '../utils/Logger';
import { errorReporter } from '../utils/ErrorReporter';
import { performanceMonitor } from '../utils/PerformanceMonitor';
import { initializeKnowledgeHandlers, KnowledgeHandlers } from './handlers/KnowledgeHandlers';
import { ToolHandlers } from './handlers/ToolHandlers';

class MultiLLMChatApp {
  private mainWindow: BrowserWindow | null = null;
  private dbManager: DatabaseManager;
  private performanceService!: PerformanceService;
  private budgetService!: BudgetService;
  private taskRepository!: TaskRepository;
  private costService: CostService;
  private qualityFeedbackRepo!: QualityFeedbackRepository;
  private performanceRepo!: PerformanceRepository;
  private knowledgeHandlers?: KnowledgeHandlers;
  private toolHandlers?: ToolHandlers;

  constructor() {
    this.dbManager = new DatabaseManager();
    this.costService = new CostService();
    this.initializeErrorLogging();
    this.initializeApp();
  }

  private async initializeErrorLogging(): Promise<void> {
    try {
      await errorLoggingSystem.initialize({
        logLevel: process.env.NODE_ENV === 'development' ? 0 : 1, // DEBUG in dev, INFO in prod
        enableConsoleLogging: true,
        enableFileLogging: true,
        enableErrorReporting: process.env.NODE_ENV !== 'development',
        enablePerformanceMonitoring: true,
        enableGracefulDegradation: true
      });

      logger.info('Multi-LLM Chat application starting', {
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        platform: `${process.platform}-${process.arch}`,
        nodeVersion: process.version
      });
    } catch (error) {
      console.error('Failed to initialize error logging system:', error);
    }
  }

  private async initializeDatabase(): Promise<void> {
    const timer = performanceMonitor.startTimer('database_initialization');
    
    try {
      logger.info('Initializing database...');
      
      // Initialize database and run migrations
      await this.dbManager.initialize();

      // Initialize repositories
      const db = this.dbManager.getDatabase();
      this.qualityFeedbackRepo = new QualityFeedbackRepository(db);
      this.performanceRepo = new PerformanceRepository(db);
      this.taskRepository = new TaskRepository(db);

      // Initialize services
      this.performanceService = new PerformanceService(this.qualityFeedbackRepo, this.performanceRepo);
      this.budgetService = new BudgetService(this.performanceRepo, this.costService);

      const duration = performanceMonitor.endTimer('database_initialization');
      logger.info('Database initialized successfully', { initializationTime: duration });
      
    } catch (error) {
      performanceMonitor.endTimer('database_initialization');
      logger.error('Failed to initialize database', { error }, error as Error);
      
      errorReporter.reportError(error as Error, {
        component: 'DatabaseManager',
        action: 'initialization',
        additionalData: {
          dbPath: this.dbManager.getDatabasePath?.() || 'unknown'
        }
      });
      
      dialog.showErrorBox('Database Error', 'Failed to initialize database. The application may not work correctly.');
      throw error;
    }
  }

  private initializeApp(): void {
    // This method will be called when Electron has finished initialization
    app.whenReady().then(async () => {
      // Initialize database before creating windows
      await this.initializeDatabase();

  await this.initializeKnowledgeAndTools();

      this.createMainWindow();

      ipcMain.handle('save-feedback', async (event, messageId, modelId, feedback) => {
        await this.performanceService.saveFeedback(messageId, modelId, feedback);
      });

      ipcMain.handle('get-tasks', async () => {
        return await this.taskRepository.list();
      });

      ipcMain.handle('get-recommended-model', async (event, taskId) => {
        return await this.performanceService.getRecommendedModel(taskId);
      });

      ipcMain.handle('get-cost-optimization-suggestions', async () => {
        const performanceData = await this.performanceService.getPerformanceData();
        return await this.costService.getCostOptimizationSuggestions(performanceData);
      });

      ipcMain.handle('create-task', async (event, name, description) => {
        const task = { id: `task_${Date.now()}`, name, description };
        await this.taskRepository.create(task);
      });

      ipcMain.handle('export-performance-data', async () => {
        const csv = await this.performanceService.getPerformanceDataAsCsv();
        const { filePath } = await dialog.showSaveDialog({
          title: 'Export Performance Data',
          defaultPath: 'performance-data.csv',
          filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        });

        if (filePath) {
          fs.writeFileSync(filePath, csv);
        }
      });

      ipcMain.handle('open-performance-dashboard', () => {
        this.createPerformanceDashboardWindow();
      });

      ipcMain.handle('get-performance-data', async (event, taskId) => {
        return await this.performanceService.getPerformanceData(taskId);
      });

      ipcMain.handle('get-budget-status', async () => {
        return await this.budgetService.getBudgetStatus();
      });

      // Error logging and monitoring handlers
      ipcMain.handle('write-log', async (event, logEntry) => {
        try {
          // Write log entry to file system
          const logDir = path.join(app.getPath('userData'), 'logs');
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          
          const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
          const logLine = `${logEntry.timestamp} [${logEntry.level}] [${logEntry.category}] ${logEntry.message}\n`;
          
          fs.appendFileSync(logFile, logLine);
        } catch (error) {
          console.error('Failed to write log to file:', error);
        }
      });

      ipcMain.handle('store-error-report', async (event, errorReport) => {
        try {
          const errorDir = path.join(app.getPath('userData'), 'errors');
          if (!fs.existsSync(errorDir)) {
            fs.mkdirSync(errorDir, { recursive: true });
          }
          
          const errorFile = path.join(errorDir, `error-${errorReport.id}.json`);
          fs.writeFileSync(errorFile, JSON.stringify(errorReport, null, 2));
        } catch (error) {
          console.error('Failed to store error report:', error);
        }
      });

      ipcMain.handle('get-stored-error-reports', async () => {
        try {
          const errorDir = path.join(app.getPath('userData'), 'errors');
          if (!fs.existsSync(errorDir)) {
            return [];
          }
          
          const files = fs.readdirSync(errorDir).filter(f => f.endsWith('.json'));
          const reports = files.map(file => {
            const content = fs.readFileSync(path.join(errorDir, file), 'utf8');
            return JSON.parse(content);
          });
          
          return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch (error) {
          console.error('Failed to get stored error reports:', error);
          return [];
        }
      });

      ipcMain.handle('clear-stored-error-reports', async () => {
        try {
          const errorDir = path.join(app.getPath('userData'), 'errors');
          if (fs.existsSync(errorDir)) {
            const files = fs.readdirSync(errorDir).filter(f => f.endsWith('.json'));
            files.forEach(file => fs.unlinkSync(path.join(errorDir, file)));
          }
        } catch (error) {
          console.error('Failed to clear stored error reports:', error);
        }
      });

      ipcMain.handle('health-check', async () => {
        try {
          // Perform basic health checks
          const dbHealthy = await this.dbManager.isHealthy?.() ?? true;
          return {
            database: dbHealthy,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          logger.error('Health check failed', { error }, error as Error);
          return {
            database: false,
            timestamp: new Date().toISOString(),
            error: (error as Error).message
          };
        }
      });

      // Conversation management handlers
      ipcMain.handle('save-conversation', async (event, conversation) => {
        try {
          return await this.dbManager.conversations.createConversation(conversation.title);
        } catch (error) {
          console.error('Failed to save conversation:', error);
          throw error;
        }
      });

      ipcMain.handle('load-conversations', async () => {
        try {
          return await this.dbManager.conversations.getAllConversations();
        } catch (error) {
          console.error('Failed to load conversations:', error);
          throw error;
        }
      });

      ipcMain.handle('load-conversation', async (event, id) => {
        try {
          return await this.dbManager.conversations.getConversation(id);
        } catch (error) {
          console.error('Failed to load conversation:', error);
          throw error;
        }
      });

      ipcMain.handle('delete-conversation', async (event, id) => {
        try {
          await this.dbManager.conversations.deleteConversation(id);
        } catch (error) {
          console.error('Failed to delete conversation:', error);
          throw error;
        }
      });

      ipcMain.handle('export-conversation', async (event, id, format) => {
        try {
          const conversation = await this.dbManager.conversations.getConversation(id);

          let content = '';
          if (format === 'json') {
            content = JSON.stringify(conversation, null, 2);
          } else if (format === 'markdown') {
            content = this.conversationToMarkdown(conversation);
          } else {
            content = this.conversationToText(conversation);
          }

          const { filePath } = await dialog.showSaveDialog({
            title: 'Export Conversation',
            defaultPath: `conversation-${id}.${format}`,
            filters: [
              { name: format.toUpperCase() + ' Files', extensions: [format] }
            ],
          });

          if (filePath) {
            fs.writeFileSync(filePath, content);
            return filePath;
          }
          return null;
        } catch (error) {
          console.error('Failed to export conversation:', error);
          throw error;
        }
      });

      // Message management handlers
      ipcMain.handle('add-message', async (event, conversationId, message) => {
        try {
          await this.dbManager.conversations.addMessage({
            ...message,
            metadata: {
              ...(message?.metadata || {}),
              conversationId
            }
          });
        } catch (error) {
          console.error('Failed to add message:', error);
          throw error;
        }
      });

      ipcMain.handle('update-message', async (event, messageId, updates) => {
        try {
          await this.dbManager.conversations.updateMessage(messageId, updates);
        } catch (error) {
          console.error('Failed to update message:', error);
          throw error;
        }
      });

      // Memory management handlers
      ipcMain.handle('save-memory', async (event, memory) => {
        try {
          await this.dbManager.memory.addFact(memory.conversationId, memory);
        } catch (error) {
          console.error('Failed to save memory:', error);
          throw error;
        }
      });

      ipcMain.handle('search-memories', async (event, query, limit) => {
        try {
          const searchQuery = {
            query,
            limit,
            type: 'all' as const
          };
          const results = await this.dbManager.memory.searchMemory('default', searchQuery);
          return [...results.facts, ...results.summaries, ...results.relationships];
        } catch (error) {
          console.error('Failed to search memories:', error);
          throw error;
        }
      });

      // LLM Orchestrator handlers
      ipcMain.handle('send-to-llms', async (event, messages, participants, apiKeys, endpoints) => {
        try {
          logger.info('Sending messages to LLMs', {
            messageCount: messages.length,
            participantCount: participants.length
          });

          // Simple direct API calls for each participant for now
          const responses = await Promise.all(
            participants.map(async (participant: any) => {
              try {
                let response = null;

                if (participant.type === 'ollama') {
                  const ollamaBaseUrl = endpoints?.ollamaEndpoint || 'http://localhost:11434';
                  const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: participant.model,
                      messages: messages.map((m: any) => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.content
                      })),
                      stream: false
                    })
                  });
                  const data = await ollamaResponse.json();
                  response = data.message?.content || data.response || 'No response';
                } else if (participant.type === 'lmstudio') {
                  const lmStudioBaseUrl = endpoints?.lmStudioEndpoint || 'http://localhost:1234';
                  const lmStudioResponse = await fetch(`${lmStudioBaseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: participant.model,
                      messages: messages.map((m: any) => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.content
                      }))
                    })
                  });
                  const data = await lmStudioResponse.json();
                  response = data.choices?.[0]?.message?.content || 'No response';
                } else if (participant.type === 'cloud' && apiKeys[participant.model]) {
                  // Handle cloud APIs (OpenAI, Claude, etc)
                  response = `Cloud API response from ${participant.model}`;
                }

                return {
                  modelId: participant.id,
                  content: response || `No response from ${participant.model}`,
                  metadata: {
                    processingTime: Date.now(),
                    provider: participant.type
                  }
                };
              } catch (error) {
                logger.error(`Failed to get response from ${participant.model}`, { error });
                return {
                  modelId: participant.id,
                  content: `Error: Failed to get response from ${participant.model}`,
                  metadata: {
                    processingTime: Date.now(),
                    provider: participant.type,
                    error: error instanceof Error ? error.message : String(error)
                  }
                };
              }
            })
          );

          logger.info('Received responses from LLMs', {
            responseCount: responses.length
          });

          return responses;
        } catch (error) {
          logger.error('Failed to send to LLMs', { error }, error as Error);
          throw error;
        }
      });

      ipcMain.handle('discover-models', async () => {
        try {
          logger.info('Discovering available models');

          // Discover models from Ollama
          const ollamaModels = await this.discoverOllamaModels();

          // Discover models from LM Studio
          const lmStudioModels = await this.discoverLMStudioModels();

          return {
            ollama: ollamaModels,
            lmstudio: lmStudioModels
          };
        } catch (error) {
          logger.error('Failed to discover models', { error }, error as Error);
          throw error;
        }
      });

      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  private async initializeKnowledgeAndTools(): Promise<void> {
    try {
      const knowledgeHandlers = initializeKnowledgeHandlers(this.dbManager);
      await knowledgeHandlers.initialize();
      this.knowledgeHandlers = knowledgeHandlers;

      const toolHandlers = new ToolHandlers(knowledgeHandlers.getKnowledgeBase());
      toolHandlers.initialize();
      this.toolHandlers = toolHandlers;
    } catch (error) {
      logger.error('Failed to initialize knowledge or tool handlers', { error });
    }
  }

  private createMainWindow(): void {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'default',
      show: false, // Don't show until ready-to-show
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3002');
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private conversationToMarkdown(conversation: any): string {
    let markdown = `# ${conversation.title || 'Conversation'}\n\n`;
    const createdAt = conversation.createdAt || conversation.created_at;
    if (createdAt) {
      const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
      markdown += `**Date:** ${createdDate.toLocaleString()}\n\n`;
    }

    if (conversation.messages) {
      for (const message of conversation.messages) {
        const sender = message.sender === 'user' ? '**You**' : `**${message.metadata?.model || message.sender}**`;
        markdown += `${sender} (${new Date(message.timestamp).toLocaleTimeString()})\n\n`;
        markdown += `${message.content}\n\n---\n\n`;
      }
    }

    return markdown;
  }

  private conversationToText(conversation: any): string {
    let text = `${conversation.title || 'Conversation'}\n`;
    const createdAt = conversation.createdAt || conversation.created_at;
    if (createdAt) {
      const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
      text += `Date: ${createdDate.toLocaleString()}\n\n`;
    }

    if (conversation.messages) {
      for (const message of conversation.messages) {
        const sender = message.sender === 'user' ? 'You' : (message.metadata?.model || message.sender);
        text += `[${new Date(message.timestamp).toLocaleTimeString()}] ${sender}:\n`;
        text += `${message.content}\n\n`;
      }
    }

    return text;
  }

  private createPerformanceDashboardWindow(): void {
    const dashboardWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    if (process.env.NODE_ENV === 'development') {
      dashboardWindow.loadURL('http://localhost:3002/performance');
    } else {
      dashboardWindow.loadFile(path.join(__dirname, 'index.html'), { hash: 'performance' });
    }
  }

  private async discoverOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      logger.warn('Failed to discover Ollama models', { error });
      return [];
    }
  }

  private async discoverLMStudioModels(): Promise<string[]> {
    try {
      const response = await fetch('http://localhost:1234/v1/models');
      const data = await response.json();
      return data.data?.map((m: any) => m.id) || [];
    } catch (error) {
      logger.warn('Failed to discover LM Studio models', { error });
      return [];
    }
  }
}

// Create app instance
new MultiLLMChatApp();