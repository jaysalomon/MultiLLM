import React, { useState, useEffect } from 'react';
import { LLMProvider, ProviderType, APIProviderConfig, OllamaProviderConfig, LMStudioProviderConfig } from '../../../types';
import './ModelConfigModal.css';

export interface ModelConfigModalProps {
  provider?: LLMProvider;
  onSave: (provider: LLMProvider) => void;
  onCancel: () => void;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  provider,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState<LLMProvider>(() => ({
    id: provider?.id || Date.now().toString(),
    name: provider?.name || '',
    type: provider?.type || 'api',
    config: provider?.config || {
      displayName: '',
      temperature: 0.7,
      maxTokens: 4000,
      timeout: 30000
    } as any,
    isActive: provider?.isActive ?? true,
    createdAt: provider?.createdAt || new Date(),
    updatedAt: new Date()
  }));

  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Focus the first input when modal opens
    const firstInput = document.querySelector('.model-config-modal input') as HTMLInputElement;
    if (firstInput) {
      firstInput.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.config.displayName) {
      setValidationError('Name and display name are required');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Basic validation based on provider type
      if (formData.type === 'api') {
        const config = formData.config as APIProviderConfig;
        if (!config.baseUrl || !config.modelName) {
          throw new Error('Base URL and model name are required for API providers');
        }
      } else if (formData.type === 'ollama') {
        const config = formData.config as OllamaProviderConfig;
        if (!config.host || !config.modelName) {
          throw new Error('Host and model name are required for Ollama providers');
        }
      } else if (formData.type === 'lmstudio') {
        const config = formData.config as LMStudioProviderConfig;
        if (!config.host || !config.modelName) {
          throw new Error('Host and model name are required for LM Studio providers');
        }
      }

      onSave(formData);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const updateConfig = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }));
  };

  const handleTypeChange = (newType: ProviderType) => {
    let newConfig: any = {
      displayName: formData.config.displayName,
      temperature: formData.config.temperature || 0.7,
      maxTokens: formData.config.maxTokens || 4000,
      timeout: formData.config.timeout || 30000
    };

    if (newType === 'api') {
      newConfig = {
        ...newConfig,
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4'
      } as APIProviderConfig;
    } else if (newType === 'ollama') {
      newConfig = {
        ...newConfig,
        host: 'http://localhost:11434',
        modelName: 'llama3.1',
        keepAlive: '5m'
      } as OllamaProviderConfig;
    } else if (newType === 'lmstudio') {
      newConfig = {
        ...newConfig,
        host: 'http://localhost:1234',
        modelName: ''
      } as LMStudioProviderConfig;
    }

    setFormData(prev => ({
      ...prev,
      type: newType,
      config: newConfig
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div data-testid="modal-overlay" className="model-config-modal__overlay" onClick={onCancel}>
      <div 
        className="model-config-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="model-config-modal__header">
          <h2 className="model-config-modal__title">
            {provider ? 'Edit Model' : 'Add New Model'}
          </h2>
          <button
            className="model-config-modal__close"
            onClick={handleCancel}
            title="Close modal"
          >
            ×
          </button>
        </div>

        <form className="model-config-modal__form" onSubmit={handleSubmit}>
          <div className="model-config-modal__field">
            <label className="model-config-modal__label">
              Provider Name
            </label>
            <input
              type="text"
              className="model-config-modal__input"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., OpenAI, Anthropic, Local Ollama"
              required
            />
          </div>

          <div className="model-config-modal__field">
            <label className="model-config-modal__label">
              Display Name
            </label>
            <input
              type="text"
              className="model-config-modal__input"
              value={formData.config.displayName}
              onChange={(e) => updateConfig('displayName', e.target.value)}
              placeholder="e.g., GPT-4, Claude 3.5, Llama 3.1"
              required
            />
          </div>

          <div className="model-config-modal__field">
            <label className="model-config-modal__label">
              Provider Type
            </label>
            <select
              className="model-config-modal__select"
              value={formData.type}
              onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
            >
              <option value="api">API (OpenAI, Anthropic, etc.)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="lmstudio">LM Studio (Local)</option>
            </select>
          </div>

          {formData.type === 'api' && (
            <>
              <div className="model-config-modal__field">
                <label className="model-config-modal__label">
                  API Key
                </label>
                <input
                  type="password"
                  className="model-config-modal__input"
                  value={(formData.config as APIProviderConfig).apiKey || ''}
                  onChange={(e) => updateConfig('apiKey', e.target.value)}
                  placeholder="Enter your API key"
                />
              </div>
              <div className="model-config-modal__field">
                <label className="model-config-modal__label">
                  Base URL
                </label>
                <input
                  type="url"
                  className="model-config-modal__input"
                  value={(formData.config as APIProviderConfig).baseUrl || ''}
                  onChange={(e) => updateConfig('baseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  required
                />
              </div>
            </>
          )}

          {(formData.type === 'ollama' || formData.type === 'lmstudio') && (
            <div className="model-config-modal__field">
              <label className="model-config-modal__label">
                Host URL
              </label>
              <input
                type="url"
                className="model-config-modal__input"
                value={(formData.config as OllamaProviderConfig | LMStudioProviderConfig).host || ''}
                onChange={(e) => updateConfig('host', e.target.value)}
                placeholder={formData.type === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
                required
              />
            </div>
          )}

          <div className="model-config-modal__field">
            <label className="model-config-modal__label">
              Model Name
            </label>
            <input
              type="text"
              className="model-config-modal__input"
              value={formData.config.modelName || ''}
              onChange={(e) => updateConfig('modelName', e.target.value)}
              placeholder="e.g., gpt-4, claude-3-sonnet-20240229, llama3.1"
              required
            />
          </div>

          <div className="model-config-modal__advanced">
            <h3 className="model-config-modal__section-title">Advanced Settings</h3>
            
            <div className="model-config-modal__field-group">
              <div className="model-config-modal__field model-config-modal__field--half">
                <label className="model-config-modal__label">
                  Temperature
                </label>
                <input
                  type="number"
                  className="model-config-modal__input"
                  value={formData.config.temperature || 0.7}
                  onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                  min="0"
                  max="2"
                  step="0.1"
                />
              </div>

              <div className="model-config-modal__field model-config-modal__field--half">
                <label className="model-config-modal__label">
                  Max Tokens
                </label>
                <input
                  type="number"
                  className="model-config-modal__input"
                  value={formData.config.maxTokens || 4000}
                  onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value))}
                  min="1"
                  max="32000"
                />
              </div>
            </div>
          </div>

          {validationError && (
            <div className="model-config-modal__error">
              {validationError}
            </div>
          )}

          <div className="model-config-modal__actions">
            <button
              type="button"
              className="model-config-modal__button model-config-modal__button--secondary"
              onClick={handleCancel}
              disabled={isValidating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="model-config-modal__button model-config-modal__button--primary"
              disabled={isValidating}
            >
              {isValidating ? 'Validating...' : (provider ? 'Update' : 'Add')} Model
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModelConfigModal;