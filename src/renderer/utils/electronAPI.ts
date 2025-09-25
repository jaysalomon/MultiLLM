import type { ElectronAPI } from '../../main/preload';

// Create mock implementation for browser
const mockElectronAPI = {
  platform: 'browser',
  versions: {
    node: '0',
    chrome: '0',
    electron: '0'
  },
  saveConversation: async () => 'mock-conversation-id',
  loadConversations: async () => [],
  loadConversation: async () => null,
  deleteConversation: async () => undefined,
  exportConversation: async () => 'mock-export',
  addMessage: async () => undefined,
  updateMessage: async () => undefined,
  saveMemory: async () => undefined,
  searchMemories: async () => [],
  getTasks: async () => [],
  createTask: async () => {},
  getPerformanceData: async () => [],
  exportPerformanceData: async () => console.log('Export not available in browser'),
  getRecommendedModel: async () => undefined,
  saveFeedback: async () => console.log('Feedback saved (mock)'),
  getBudgetStatus: async () => ({ budget: 0, spending: 0, remaining: 0 }),
  getCostOptimizationSuggestions: async () => [],
  openPerformanceDashboard: async () => console.log('Dashboard not available in browser'),
  writeLog: async () => undefined,
  storeErrorReport: async () => undefined,
  getStoredErrorReports: async () => [],
  clearStoredErrorReports: async () => undefined,
  healthCheck: async () => ({ database: true, timestamp: new Date().toISOString() }),
  knowledge: {
    addDocument: async () => ({}),
    addDocuments: async () => [],
    getDocuments: async () => ({}),
    getDocument: async () => ({}),
    deleteDocument: async () => ({}),
    updateDocument: async () => ({}),
    search: async () => ({}),
    searchWithContext: async () => ({}),
    hybridSearch: async () => ({}),
    getStats: async () => ({}),
    export: async () => ({}),
    selectFiles: async () => ({}),
    getContextForQuery: async () => ({}),
    refreshEmbeddings: async () => ({}),
    clearAll: async () => ({}),
    on: () => {},
    off: () => {},
  },
  sendToLLMs: async () => [],
  discoverModels: async () => ({ ollama: [], lmstudio: [] }),
  tools: {
    getRegistered: async () => [],
    execute: async () => JSON.stringify({ error: 'Tools unavailable in mock environment' }),
    executeBatch: async () => ({}),
  }
};

// Initialize mock if not in Electron
if (typeof window !== 'undefined' && !(window as any).electronAPI) {
  (window as any).electronAPI = mockElectronAPI as unknown as ElectronAPI;
}

export {};