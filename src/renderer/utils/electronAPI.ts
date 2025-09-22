// Mock electronAPI for browser development
interface ElectronAPI {
  getTasks: () => Promise<any[]>;
  createTask: (name: string, description: string) => Promise<void>;
  getPerformanceData: (taskId?: string) => Promise<any[]>;
  exportPerformanceData: () => void;
  getRecommendedModel: (taskId: string) => Promise<any>;
  saveFeedback: (messageId: string, modelId: string, feedback: any) => void;
  getBudgetStatus: () => Promise<any>;
  getCostOptimizationSuggestions: () => Promise<any[]>;
  openPerformanceDashboard: () => void;
}

// Create mock implementation for browser
const mockElectronAPI: ElectronAPI = {
  getTasks: async () => [],
  createTask: async () => {},
  getPerformanceData: async () => [],
  exportPerformanceData: () => console.log('Export not available in browser'),
  getRecommendedModel: async () => null,
  saveFeedback: () => console.log('Feedback saved (mock)'),
  getBudgetStatus: async () => ({ used: 0, limit: 100, remaining: 100 }),
  getCostOptimizationSuggestions: async () => [],
  openPerformanceDashboard: () => console.log('Dashboard not available in browser'),
};

// Extend window interface
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Initialize mock if not in Electron
if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = mockElectronAPI;
}

export {};