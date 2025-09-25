import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Conversation management
  saveConversation: (conversation: any) => ipcRenderer.invoke('save-conversation', conversation),
  loadConversations: () => ipcRenderer.invoke('load-conversations'),
  loadConversation: (id: string) => ipcRenderer.invoke('load-conversation', id),
  deleteConversation: (id: string) => ipcRenderer.invoke('delete-conversation', id),
  exportConversation: (id: string, format: string) => ipcRenderer.invoke('export-conversation', id, format),

  // Message management
  addMessage: (conversationId: string, message: any) => ipcRenderer.invoke('add-message', conversationId, message),
  updateMessage: (messageId: string, updates: any) => ipcRenderer.invoke('update-message', messageId, updates),

  // Memory management
  saveMemory: (memory: any) => ipcRenderer.invoke('save-memory', memory),
  searchMemories: (query: string, limit?: number) => ipcRenderer.invoke('search-memories', query, limit),

  // LLM orchestrator
  sendToLLMs: (messages: any[], participants: any[], apiKeys: any, endpoints?: any) =>
    ipcRenderer.invoke('send-to-llms', messages, participants, apiKeys, endpoints),
  discoverModels: () => ipcRenderer.invoke('discover-models'),

  // Knowledge Base Management
  knowledge: {
    addDocument: (filePath: string) => ipcRenderer.invoke('knowledge:addDocument', filePath),
    addDocuments: (filePaths: string[]) => ipcRenderer.invoke('knowledge:addDocuments', filePaths),
    getDocuments: () => ipcRenderer.invoke('knowledge:getDocuments'),
    getDocument: (documentId: string) => ipcRenderer.invoke('knowledge:getDocument', documentId),
    deleteDocument: (documentId: string) => ipcRenderer.invoke('knowledge:deleteDocument', documentId),
    updateDocument: (documentId: string, filePath: string) => ipcRenderer.invoke('knowledge:updateDocument', documentId, filePath),
    search: (query: string, options?: any) => ipcRenderer.invoke('knowledge:search', query, options),
    searchWithContext: (query: string, conversationHistory?: any[]) => ipcRenderer.invoke('knowledge:searchWithContext', query, conversationHistory),
    hybridSearch: (query: string, keywords: string[]) => ipcRenderer.invoke('knowledge:hybridSearch', query, keywords),
    getStats: () => ipcRenderer.invoke('knowledge:getStats'),
    export: (format?: 'json' | 'markdown') => ipcRenderer.invoke('knowledge:export', format),
    selectFiles: () => ipcRenderer.invoke('knowledge:selectFiles'),
    getContextForQuery: (query: string, maxTokens?: number) => ipcRenderer.invoke('knowledge:getContextForQuery', query, maxTokens),
    refreshEmbeddings: () => ipcRenderer.invoke('knowledge:refreshEmbeddings'),
    clearAll: () => ipcRenderer.invoke('knowledge:clearAll'),

    // Event listeners
    on: (channel: string, callback: Function) => {
      const validChannels = [
        'knowledge:document:adding',
        'knowledge:document:added',
        'knowledge:document:error',
        'knowledge:query:start',
        'knowledge:query:complete'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      }
    },

    off: (channel: string, callback: Function) => {
      ipcRenderer.removeListener(channel, callback as any);
    }
  },

  // Performance tracking
  saveFeedback: (messageId: string, modelId: string, feedback: 'good' | 'bad') => ipcRenderer.invoke('save-feedback', messageId, modelId, feedback),
  getBudgetStatus: () => ipcRenderer.invoke('get-budget-status'),
  getPerformanceData: () => ipcRenderer.invoke('get-performance-data'),
  openPerformanceDashboard: () => ipcRenderer.invoke('open-performance-dashboard'),
  exportPerformanceData: () => ipcRenderer.invoke('export-performance-data'),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  createTask: (name: string, description: string) => ipcRenderer.invoke('create-task', name, description),
  getCostOptimizationSuggestions: () => ipcRenderer.invoke('get-cost-optimization-suggestions'),
  getRecommendedModel: (taskId: string) => ipcRenderer.invoke('get-recommended-model', taskId),

  // Error logging and monitoring
  writeLog: (logEntry: any) => ipcRenderer.invoke('write-log', logEntry),
  storeErrorReport: (errorReport: any) => ipcRenderer.invoke('store-error-report', errorReport),
  getStoredErrorReports: () => ipcRenderer.invoke('get-stored-error-reports'),
  clearStoredErrorReports: () => ipcRenderer.invoke('clear-stored-error-reports'),
  healthCheck: () => ipcRenderer.invoke('health-check'),
});

// Type definitions for the exposed API
export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  // Conversation management
  saveConversation: (conversation: any) => Promise<string>;
  loadConversations: () => Promise<any[]>;
  loadConversation: (id: string) => Promise<any>;
  deleteConversation: (id: string) => Promise<void>;
  exportConversation: (id: string, format: string) => Promise<string>;
  // Message management
  addMessage: (conversationId: string, message: any) => Promise<void>;
  updateMessage: (messageId: string, updates: any) => Promise<void>;
  // Memory management
  saveMemory: (memory: any) => Promise<void>;
  searchMemories: (query: string, limit?: number) => Promise<any[]>;
  // Knowledge Base Management
  knowledge: {
    addDocument: (filePath: string) => Promise<any>;
    addDocuments: (filePaths: string[]) => Promise<any[]>;
    getDocuments: () => Promise<any>;
    getDocument: (documentId: string) => Promise<any>;
    deleteDocument: (documentId: string) => Promise<any>;
    updateDocument: (documentId: string, filePath: string) => Promise<any>;
    search: (query: string, options?: any) => Promise<any>;
    searchWithContext: (query: string, conversationHistory?: any[]) => Promise<any>;
    hybridSearch: (query: string, keywords: string[]) => Promise<any>;
    getStats: () => Promise<any>;
    export: (format?: 'json' | 'markdown') => Promise<any>;
    selectFiles: () => Promise<any>;
    getContextForQuery: (query: string, maxTokens?: number) => Promise<any>;
    refreshEmbeddings: () => Promise<any>;
    clearAll: () => Promise<any>;
    on: (channel: string, callback: Function) => void;
    off: (channel: string, callback: Function) => void;
  };
  // Performance tracking
  saveFeedback: (messageId: string, modelId: string, feedback: 'good' | 'bad') => Promise<void>;
  getBudgetStatus: () => Promise<{ budget: number; spending: number; remaining: number }>;
  getPerformanceData: () => Promise<any[]>;
  openPerformanceDashboard: () => Promise<void>;
  exportPerformanceData: () => Promise<void>;
  getTasks: () => Promise<any[]>;
  createTask: (name: string, description: string) => Promise<void>;
  getCostOptimizationSuggestions: () => Promise<string[]>;
  getRecommendedModel: (taskId: string) => Promise<string | undefined>;
  // LLM orchestrator
  sendToLLMs: (messages: any[], participants: any[], apiKeys: any, endpoints?: any) => Promise<any[]>;
  discoverModels: () => Promise<{ ollama: string[]; lmstudio: string[] }>;
  // Error logging and monitoring
  writeLog: (logEntry: any) => Promise<void>;
  storeErrorReport: (errorReport: any) => Promise<void>;
  getStoredErrorReports: () => Promise<any[]>;
  clearStoredErrorReports: () => Promise<void>;
  healthCheck: () => Promise<{ database: boolean; timestamp: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
