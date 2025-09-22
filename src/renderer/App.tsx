import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ChatInterface } from './components/chat';
import { PerformanceDashboard } from './components/performance/PerformanceDashboard';
import { ChatMessage, ModelParticipant } from '../types/chat';
import { LLMCommunicationSystem } from '../orchestrator/LLMCommunicationSystem';
import { LLMOrchestrator } from '../orchestrator/LLMOrchestrator';
import { ThemeSettings } from './components/settings/ThemeSettings';
import { useKeyboardNavigation, globalKeyboardShortcuts, createSkipToContent } from './hooks/useKeyboardNavigation';
import { useTheme } from './contexts/ThemeContext';
import { errorLoggingSystem } from '../utils/ErrorLoggingSystem';
import { logger } from '../utils/Logger';
import { addBreadcrumb } from '../utils/ErrorReporter';
import { performanceMonitor } from '../utils/PerformanceMonitor';
import { ProviderFactory } from '../providers/ProviderFactory';
import type { LLMProvider, APIProviderConfig, OllamaProviderConfig, LMStudioProviderConfig } from '../types/providers';
import './App.css';

// Provider Configuration Form Component
const ProviderConfigForm = ({ provider, onSave, onCancel }: {
  provider?: LLMProvider;
  onSave: (provider: LLMProvider) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<LLMProvider>(provider || {
    id: `provider_${Date.now()}`,
    name: '',
    type: 'api',
    config: {
      temperature: 0.7,
      maxTokens: 4000
    } as APIProviderConfig,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate configuration
    const validation = await ProviderFactory.validateProviderConfig(formData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    onSave(formData);
  };

  const updateConfig = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
      updatedAt: new Date()
    }));
    setValidationErrors([]); // Clear errors on change
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content provider-config-form">
        <h2>{provider ? 'Edit Provider' : 'Add New Provider'}</h2>

        {validationErrors.length > 0 && (
          <div className="validation-errors">
            {validationErrors.map((error, idx) => (
              <div key={idx} className="error-message">{error}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Provider Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value, updatedAt: new Date() }))}
              placeholder="e.g., OpenAI GPT-4"
              required
            />
          </div>

          <div className="form-group">
            <label>Provider Type</label>
            <select
              value={formData.type}
              onChange={(e) => {
                const type = e.target.value as 'api' | 'ollama' | 'lmstudio';
                let newConfig: any = { temperature: 0.7, maxTokens: 4000 };

                if (type === 'api') {
                  newConfig = { ...newConfig, baseUrl: '', apiKey: '', modelName: '' } as APIProviderConfig;
                } else if (type === 'ollama') {
                  newConfig = { ...newConfig, host: 'http://localhost:11434', modelName: '' } as OllamaProviderConfig;
                } else if (type === 'lmstudio') {
                  newConfig = { ...newConfig, baseUrl: 'http://localhost:1234', modelId: '' } as LMStudioProviderConfig;
                }

                setFormData(prev => ({ ...prev, type, config: newConfig, updatedAt: new Date() }));
              }}
            >
              <option value="api">API (OpenAI, Anthropic, etc.)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="lmstudio">LM Studio (Local)</option>
            </select>
          </div>

          {formData.type === 'api' && (
            <>
              <div className="form-group">
                <label>API Key (Encrypted)</label>
                <input
                  type="password"
                  value={(formData.config as APIProviderConfig).apiKey || ''}
                  onChange={(e) => updateConfig('apiKey', e.target.value)}
                  placeholder="sk-..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Base URL</label>
                <input
                  type="url"
                  value={(formData.config as APIProviderConfig).baseUrl || ''}
                  onChange={(e) => updateConfig('baseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  required
                  pattern="https?://.*"
                />
              </div>
              <div className="form-group">
                <label>Model Name</label>
                <input
                  type="text"
                  value={(formData.config as APIProviderConfig).modelName || ''}
                  onChange={(e) => updateConfig('modelName', e.target.value)}
                  placeholder="gpt-4, claude-3-sonnet-20240229"
                  required
                />
              </div>
            </>
          )}

          {formData.type === 'ollama' && (
            <>
              <div className="form-group">
                <label>Ollama Host</label>
                <input
                  type="url"
                  value={(formData.config as OllamaProviderConfig).host || ''}
                  onChange={(e) => updateConfig('host', e.target.value)}
                  placeholder="http://localhost:11434"
                  required
                  pattern="https?://.*"
                />
              </div>
              <div className="form-group">
                <label>Model Name</label>
                <input
                  type="text"
                  value={(formData.config as OllamaProviderConfig).modelName || ''}
                  onChange={(e) => updateConfig('modelName', e.target.value)}
                  placeholder="llama3, mixtral, codellama"
                  required
                />
              </div>
            </>
          )}

          {formData.type === 'lmstudio' && (
            <>
              <div className="form-group">
                <label>LM Studio URL</label>
                <input
                  type="url"
                  value={(formData.config as LMStudioProviderConfig).baseUrl || ''}
                  onChange={(e) => updateConfig('baseUrl', e.target.value)}
                  placeholder="http://localhost:1234"
                  required
                  pattern="https?://.*"
                />
              </div>
              <div className="form-group">
                <label>Model ID</label>
                <input
                  type="text"
                  value={(formData.config as LMStudioProviderConfig).modelId || ''}
                  onChange={(e) => updateConfig('modelId', e.target.value)}
                  placeholder="model-identifier"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Temperature (0-2)</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={formData.config.temperature || 0.7}
              onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>Max Tokens</label>
            <input
              type="number"
              min="100"
              max="32000"
              value={formData.config.maxTokens || 4000}
              onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {provider ? 'Update' : 'Add'} Provider
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Settings Panel Component
const SettingsPanel = ({ providers, onUpdateProviders, onClose }: {
  providers: LLMProvider[];
  onUpdateProviders: (providers: LLMProvider[]) => void;
  onClose: () => void;
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | undefined>();
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map());
  const [isDiscovering, setIsDiscovering] = useState(false);

  const discoverLocalModels = async () => {
    setIsDiscovering(true);
    const discovered: LLMProvider[] = [];

    try {
      // Discover Ollama models
      try {
        const ollamaResponse = await fetch('http://localhost:11434/api/tags');
        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          const models = data.models || [];

          models.forEach((model: any) => {
            const id = `ollama_${model.name.replace(/[^a-z0-9]/gi, '_')}`;
            if (!providers.find(p => p.id === id)) {
              discovered.push({
                id,
                name: `Ollama - ${model.name}`,
                type: 'ollama',
                config: {
                  host: 'http://localhost:11434',
                  modelName: model.name,
                  temperature: 0.7,
                  maxTokens: 4000
                } as OllamaProviderConfig,
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          });
        }
      } catch (error) {
        logger.warn('Failed to discover Ollama models', { error });
      }

      // Discover LM Studio models
      try {
        const lmStudioResponse = await fetch('http://localhost:1234/v1/models');
        if (lmStudioResponse.ok) {
          const data = await lmStudioResponse.json();
          const models = data.data || [];

          models.forEach((model: any) => {
            const id = `lmstudio_${model.id.replace(/[^a-z0-9]/gi, '_')}`;
            if (!providers.find(p => p.id === id)) {
              discovered.push({
                id,
                name: `LM Studio - ${model.id}`,
                type: 'lmstudio',
                config: {
                  baseUrl: 'http://localhost:1234',
                  modelId: model.id,
                  temperature: 0.7,
                  maxTokens: 4000
                } as LMStudioProviderConfig,
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          });
        }
      } catch (error) {
        logger.warn('Failed to discover LM Studio models', { error });
      }

      if (discovered.length > 0) {
        onUpdateProviders([...providers, ...discovered]);
        addBreadcrumb({
          category: 'provider_discovery',
          message: `Discovered ${discovered.length} local models`,
          level: 'info'
        });
      }
    } finally {
      setIsDiscovering(false);
    }
  };

  const testProvider = async (provider: LLMProvider) => {
    try {
      const providerInstance = await ProviderFactory.createProvider(provider);
      const result = await providerInstance.testConnection();
      setTestResults(prev => new Map(prev).set(provider.id, result.success));

      if (!result.success) {
        logger.warn('Provider test failed', { providerId: provider.id, error: result.error });
      }
    } catch (error) {
      setTestResults(prev => new Map(prev).set(provider.id, false));
      logger.error('Provider test error', { providerId: provider.id }, error as Error);
    }
  };

  const handleAddProvider = async (provider: LLMProvider) => {
    try {
      // Create provider instance to validate
      await ProviderFactory.createProvider(provider);
      onUpdateProviders([...providers, provider]);
      setShowForm(false);
      setEditingProvider(undefined);

      addBreadcrumb({
        category: 'provider_management',
        message: `Added provider: ${provider.name}`,
        level: 'info'
      });
    } catch (error) {
      logger.error('Failed to add provider', { provider }, error as Error);
    }
  };

  const handleUpdateProvider = async (provider: LLMProvider) => {
    try {
      // Validate updated configuration
      await ProviderFactory.createProvider(provider);

      const updated = providers.map(p => p.id === provider.id ? provider : p);
      onUpdateProviders(updated);
      setShowForm(false);
      setEditingProvider(undefined);

      addBreadcrumb({
        category: 'provider_management',
        message: `Updated provider: ${provider.name}`,
        level: 'info'
      });
    } catch (error) {
      logger.error('Failed to update provider', { provider }, error as Error);
    }
  };

  const toggleProvider = (id: string) => {
    const updated = providers.map(p =>
      p.id === id ? { ...p, isActive: !p.isActive, updatedAt: new Date() } : p
    );
    onUpdateProviders(updated);
  };

  const deleteProvider = (id: string) => {
    ProviderFactory.removeProvider(id);
    onUpdateProviders(providers.filter(p => p.id !== id));

    addBreadcrumb({
      category: 'provider_management',
      message: `Removed provider: ${id}`,
      level: 'info'
    });
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Provider Settings</h2>
        <button onClick={onClose} className="btn-close">×</button>
      </div>

      <div className="settings-content">
        <div className="settings-actions">
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + Add Provider
          </button>
          <button onClick={discoverLocalModels} disabled={isDiscovering} className="btn-secondary">
            {isDiscovering ? '🔄 Scanning...' : '🔍 Discover Local Models'}
          </button>
        </div>

        <div className="providers-list">
          <h3>Configured Providers ({providers.length})</h3>
          {providers.length === 0 ? (
            <p className="empty-state">No providers configured. Add one to get started!</p>
          ) : (
            providers.map(provider => {
              const testResult = testResults.get(provider.id);
              return (
                <div key={provider.id} className={`provider-card ${provider.isActive ? 'active' : ''}`}>
                  <div className="provider-info">
                    <h4>{provider.name}</h4>
                    <span className="provider-type">{provider.type}</span>
                    {testResult !== undefined && (
                      <span className={`test-result ${testResult ? 'success' : 'failure'}`}>
                        {testResult ? '✅' : '❌'}
                      </span>
                    )}
                  </div>
                  <div className="provider-actions">
                    <button onClick={() => toggleProvider(provider.id)} className="btn-small">
                      {provider.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => testProvider(provider)} className="btn-small">
                      Test
                    </button>
                    <button onClick={() => {
                      setEditingProvider(provider);
                      setShowForm(true);
                    }} className="btn-small">
                      Edit
                    </button>
                    <button onClick={() => deleteProvider(provider.id)} className="btn-small btn-danger">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showForm && (
        <ProviderConfigForm
          provider={editingProvider}
          onSave={editingProvider ? handleUpdateProvider : handleAddProvider}
          onCancel={() => {
            setShowForm(false);
            setEditingProvider(undefined);
          }}
        />
      )}
    </div>
  );
};

// Main Multi-LLM Chat Interface
const MultiLLMChatInterface = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const orchestratorRef = useRef<LLMOrchestrator | null>(null);
  const communicationSystemRef = useRef<LLMCommunicationSystem>(new LLMCommunicationSystem());

  // Initialize orchestrator when providers change
  useEffect(() => {
    const initializeOrchestrator = async () => {
      const activeProviders = providers.filter(p => p.isActive);
      if (activeProviders.length === 0) {
        orchestratorRef.current = null;
        return;
      }

      try {
        // Create provider instances
        const providerInstances = await ProviderFactory.createProviders(activeProviders);

        // Create participants
        const participants: ModelParticipant[] = activeProviders.map(p => ({
          id: p.id,
          provider: p,
          modelName: p.type === 'api'
            ? (p.config as APIProviderConfig).modelName
            : p.type === 'ollama'
            ? (p.config as OllamaProviderConfig).modelName
            : (p.config as LMStudioProviderConfig).modelId,
          displayName: p.name,
          color: getProviderColor(p.type, p.id),
          isActive: p.isActive,
          addedAt: new Date()
        }));

        // Initialize orchestrator
        orchestratorRef.current = new LLMOrchestrator(
          participants,
          providerInstances,
          {
            enableConcurrentRequests: true,
            maxConcurrentRequests: 5,
            requestTimeout: 30000,
            retryAttempts: 2,
            enableResponseAggregation: true
          }
        );

        // Update communication system
        communicationSystemRef.current.updateParticipants(participants);

        logger.info('Orchestrator initialized', {
          activeProviders: activeProviders.length,
          participants: participants.map(p => p.displayName)
        });

      } catch (error) {
        logger.error('Failed to initialize orchestrator', {}, error as Error);
        orchestratorRef.current = null;
      }
    };

    initializeOrchestrator();
  }, [providers]);

  // Save providers to localStorage
  useEffect(() => {
    if (providers.length > 0) {
      localStorage.setItem('llm_providers', JSON.stringify(providers));
    }
  }, [providers]);

  // Load providers from localStorage on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const saved = localStorage.getItem('llm_providers');
        if (saved) {
          const loaded = JSON.parse(saved) as LLMProvider[];
          // Revalidate dates
          const validated = loaded.map(p => ({
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt)
          }));
          setProviders(validated);
        } else {
          setShowSettings(true); // Show settings on first run
        }
      } catch (error) {
        logger.error('Failed to load saved providers', {}, error as Error);
      }
    };

    loadProviders();
  }, []);

  const handleSendMessage = useCallback(async (content: string, taskId?: string, replyToMessage?: ChatMessage) => {
    if (!orchestratorRef.current) {
      logger.warn('No active providers configured');
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      content,
      sender: 'user',
      timestamp: new Date(),
      replyTo: replyToMessage?.id,
      taskId,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const timer = performanceMonitor.startTimer('llm_response');

    try {
      // Send request through orchestrator
      const responses = await orchestratorRef.current.sendMessage({
        messages: [
          ...messages.slice(-10).map(m => ({
            role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: m.content
          })),
          { role: 'user' as const, content }
        ],
        systemPrompt: `You are participating in a multi-model conversation. Be concise and helpful.`,
        metadata: {
          conversationId: 'current',
          messageId: userMessage.id
        }
      });

      // Add responses to messages
      const aiMessages: ChatMessage[] = responses
        .filter(r => r.content && !r.metadata?.error)
        .map(response => {
          const provider = providers.find(p => p.id === response.modelId);
          return {
            id: `msg_${Date.now()}_${response.modelId}`,
            content: response.content,
            sender: response.modelId,
            timestamp: new Date(),
            metadata: {
              model: provider?.name || response.modelId,
              provider: provider?.type || 'unknown',
              processingTime: response.metadata?.processingTime,
              tokenCount: response.usage?.totalTokens
            },
            replyTo: userMessage.id
          };
        });

      setMessages(prev => [...prev, ...aiMessages]);

      performanceMonitor.endTimer('llm_response', 'llm', {
        responseCount: aiMessages.length
      });

      addBreadcrumb({
        category: 'llm_interaction',
        message: `Received ${aiMessages.length} responses`,
        level: 'info',
        data: { messageId: userMessage.id }
      });

    } catch (error) {
      logger.error('Failed to get LLM responses', { messageId: userMessage.id }, error as Error);
      performanceMonitor.endTimer('llm_response');
    } finally {
      setIsLoading(false);
    }
  }, [providers, messages]);

  return (
    <div className="multi-llm-chat">
      <div className="chat-container">
        <div className="chat-header">
          <button onClick={() => setMessages([])} className="btn-secondary">
            🆕 New Chat
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="btn-primary">
            ⚙️ Settings
          </button>
        </div>

        <ChatInterface
          messages={messages}
          participants={providers.filter(p => p.isActive).map(p => ({
            id: p.id,
            provider: p,
            modelName: p.name,
            displayName: p.name,
            color: getProviderColor(p.type, p.id),
            isActive: p.isActive,
            addedAt: new Date()
          }))}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          disabled={!orchestratorRef.current}
        />
      </div>

      {showSettings && (
        <SettingsPanel
          providers={providers}
          onUpdateProviders={setProviders}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

// Helper function for consistent provider colors
const getProviderColor = (type: string, id: string): string => {
  const colors = {
    api: ['#3498db', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'],
    ollama: ['#2ecc71', '#27ae60', '#16a085', '#f1c40f', '#e67e22'],
    lmstudio: ['#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7', '#ecf0f1']
  };

  const typeColors = colors[type as keyof typeof colors] || colors.api;
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return typeColors[hash % typeColors.length];
};

// Main App Component
const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  // Initialize error logging on mount
  useEffect(() => {
    const initApp = async () => {
      const timer = performanceMonitor.startTimer('app_startup');

      try {
        // Initialize error logging if not already done
        await errorLoggingSystem.initialize({
          logLevel: process.env.NODE_ENV === 'development' ? 0 : 1,
          enableConsoleLogging: true,
          enableFileLogging: true,
          enableErrorReporting: process.env.NODE_ENV !== 'development',
          enablePerformanceMonitoring: true,
          enableGracefulDegradation: true
        });

        logger.info('Application initialized', {
          version: '1.0.0',
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        });

        performanceMonitor.endTimer('app_startup', 'app');

      } catch (error) {
        console.error('Failed to initialize application:', error);
      }
    };

    initApp();

    return () => {
      // Cleanup on unmount
      ProviderFactory.clearAll();
      errorLoggingSystem.shutdown();
    };
  }, []);

  // Setup keyboard navigation
  useKeyboardNavigation({
    shortcuts: [
      ...globalKeyboardShortcuts,
      {
        key: 'Escape',
        handler: () => setShowSettings(false),
        description: 'Close settings',
      },
    ],
    enableArrowNavigation: false,
    containerRef: appRef,
  });

  return (
    <div className="app" ref={appRef}>
      <Router>
        <Routes>
          <Route path="/" element={<MultiLLMChatInterface />} />
          <Route path="/performance" element={<PerformanceDashboard />} />
        </Routes>
      </Router>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <ThemeSettings />
            <button onClick={() => setShowSettings(false)} className="btn-close">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;