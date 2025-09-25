import { ipcMain, dialog, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { KnowledgeBase } from '../../services/KnowledgeBase';
import { DocumentManager } from '../../services/DocumentManager';
import { DatabaseManager } from '../../database/DatabaseManager';
import { logger } from '../../utils/Logger';

export class KnowledgeHandlers {
  private knowledgeBase: KnowledgeBase;
  private documentManager: DocumentManager;
  private isInitialized: boolean = false;

  constructor(private dbManager: DatabaseManager) {
    this.documentManager = new DocumentManager(dbManager);
    this.knowledgeBase = new KnowledgeBase(dbManager);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing knowledge handlers...');

      await this.knowledgeBase.initialize();

      // Set up event listeners
      this.setupEventListeners();

      // Register IPC handlers
      this.registerHandlers();

      this.isInitialized = true;
      logger.info('Knowledge handlers initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize knowledge handlers', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Forward knowledge base events to renderer
    this.knowledgeBase.on('document:adding', (data) => {
      this.sendToRenderer('knowledge:document:adding', data);
    });

    this.knowledgeBase.on('document:added', (data) => {
      this.sendToRenderer('knowledge:document:added', data);
    });

    this.knowledgeBase.on('document:error', (data) => {
      this.sendToRenderer('knowledge:document:error', data);
    });

    this.knowledgeBase.on('query:start', (data) => {
      this.sendToRenderer('knowledge:query:start', data);
    });

    this.knowledgeBase.on('query:complete', (data) => {
      this.sendToRenderer('knowledge:query:complete', data);
    });
  }

  private registerHandlers(): void {
    // Document management
    ipcMain.handle('knowledge:addDocument', async (event, filePath: string) => {
      try {
        logger.info('Adding document to knowledge base', { filePath });

        // Validate file exists
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          throw new Error('Path is not a file');
        }

        // Add to knowledge base
        const documentId = await this.knowledgeBase.addDocument(filePath);

        logger.info('Document added successfully', { documentId, filePath });
        return { success: true, documentId };
      } catch (error) {
        logger.error('Failed to add document', { filePath, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('knowledge:addDocuments', async (event, filePaths: string[]) => {
      const results = [];

      for (const filePath of filePaths) {
        try {
          const documentId = await this.knowledgeBase.addDocument(filePath);
          results.push({ filePath, success: true, documentId });
        } catch (error) {
          results.push({
            filePath,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return results;
    });

    ipcMain.handle('knowledge:getDocuments', async () => {
      try {
        const documents = await this.knowledgeBase.getDocuments();
        return { success: true, documents };
      } catch (error) {
        logger.error('Failed to get documents', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          documents: []
        };
      }
    });

    ipcMain.handle('knowledge:getDocument', async (event, documentId: string) => {
      try {
        const document = await this.knowledgeBase.getDocument(documentId);
        return { success: true, document };
      } catch (error) {
        logger.error('Failed to get document', { documentId, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('knowledge:deleteDocument', async (event, documentId: string) => {
      try {
        await this.knowledgeBase.removeDocument(documentId);
        logger.info('Document deleted successfully', { documentId });
        return { success: true };
      } catch (error) {
        logger.error('Failed to delete document', { documentId, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('knowledge:updateDocument', async (event, documentId: string, filePath: string) => {
      try {
        await this.knowledgeBase.updateDocument(documentId, filePath);
        logger.info('Document updated successfully', { documentId });
        return { success: true };
      } catch (error) {
        logger.error('Failed to update document', { documentId, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Search and query
    ipcMain.handle('knowledge:search', async (event, query: string, options?: any) => {
      try {
        const result = await this.knowledgeBase.query(query, options);
        return { success: true, result };
      } catch (error) {
        logger.error('Failed to search knowledge base', { query, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('knowledge:searchWithContext', async (event, query: string, conversationHistory?: any[]) => {
      try {
        const result = await this.knowledgeBase.queryWithContext(query, conversationHistory);
        return { success: true, result };
      } catch (error) {
        logger.error('Failed to search with context', { query, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('knowledge:hybridSearch', async (event, query: string, keywords: string[]) => {
      try {
        const result = await this.knowledgeBase.hybridSearch(query, keywords);
        return { success: true, result };
      } catch (error) {
        logger.error('Failed to perform hybrid search', { query, keywords, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Statistics and export
    ipcMain.handle('knowledge:getStats', async () => {
      try {
        const stats = await this.knowledgeBase.getStats();
        return { success: true, stats };
      } catch (error) {
        logger.error('Failed to get knowledge base stats', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('knowledge:export', async (event, format: 'json' | 'markdown' = 'json') => {
      try {
        const content = await this.knowledgeBase.exportKnowledge(format);

        const { filePath } = await dialog.showSaveDialog({
          title: 'Export Knowledge Base',
          defaultPath: `knowledge-base.${format === 'json' ? 'json' : 'md'}`,
          filters: format === 'json'
            ? [{ name: 'JSON Files', extensions: ['json'] }]
            : [{ name: 'Markdown Files', extensions: ['md'] }]
        });

        if (filePath) {
          await fs.writeFile(filePath, content, 'utf-8');
          logger.info('Knowledge base exported', { filePath, format });
          return { success: true, filePath };
        }

        return { success: false, error: 'Export cancelled' };
      } catch (error) {
        logger.error('Failed to export knowledge base', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // File browser for document selection
    ipcMain.handle('knowledge:selectFiles', async () => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Documents',
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'doc', 'docx', 'json', 'csv', 'html'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return { success: true, filePaths: result.filePaths };
        }

        return { success: false, error: 'No files selected' };
      } catch (error) {
        logger.error('Failed to select files', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // RAG context for conversations
    ipcMain.handle('knowledge:getContextForQuery', async (event, query: string, maxTokens?: number) => {
      try {
        const result = await this.documentManager.getRelevantContext(query, maxTokens);
        return { success: true, context: result };
      } catch (error) {
        logger.error('Failed to get context for query', { query, error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          context: ''
        };
      }
    });

    // Refresh embeddings (maintenance operation)
    ipcMain.handle('knowledge:refreshEmbeddings', async () => {
      try {
        logger.info('Refreshing document embeddings...');
        await this.documentManager.refreshEmbeddings();
        logger.info('Document embeddings refreshed successfully');
        return { success: true };
      } catch (error) {
        logger.error('Failed to refresh embeddings', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Clear all documents (danger zone)
    ipcMain.handle('knowledge:clearAll', async () => {
      try {
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Clear Knowledge Base',
          message: 'Are you sure you want to clear all documents from the knowledge base?',
          detail: 'This action cannot be undone.',
          buttons: ['Cancel', 'Clear All'],
          defaultId: 0,
          cancelId: 0
        });

        if (result.response === 1) {
          const documents = await this.knowledgeBase.getDocuments();
          for (const doc of documents) {
            await this.knowledgeBase.removeDocument(doc.id);
          }
          logger.info('Knowledge base cleared');
          return { success: true };
        }

        return { success: false, error: 'Operation cancelled' };
      } catch (error) {
        logger.error('Failed to clear knowledge base', { error });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  private sendToRenderer(channel: string, data: any): void {
    // Send to all windows
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: Electron.BrowserWindow) => {
      window.webContents.send(channel, data);
    });
  }

  async cleanup(): Promise<void> {
    // Cleanup resources if needed
    logger.info('Cleaning up knowledge handlers');
  }
}

// Export singleton instance
let knowledgeHandlers: KnowledgeHandlers | null = null;

export function initializeKnowledgeHandlers(dbManager: DatabaseManager): KnowledgeHandlers {
  if (!knowledgeHandlers) {
    knowledgeHandlers = new KnowledgeHandlers(dbManager);
  }
  return knowledgeHandlers;
}

export function getKnowledgeHandlers(): KnowledgeHandlers | null {
  return knowledgeHandlers;
}