import React, { useState } from 'react';
import { LLMProvider, ProviderStatus } from '../../../types';
import { ModelCard } from '../models/ModelCard';
import { ModelConfigModal } from '../models/ModelConfigModal';
import './ProviderSettings.css';

interface ProviderSettingsProps {
  providers: LLMProvider[];
  providerStatuses: Map<string, ProviderStatus>;
  onUpdateProviders: (providers: LLMProvider[]) => void;
  onClose: () => void;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({ 
  providers, 
  providerStatuses, 
  onUpdateProviders, 
  onClose 
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | undefined>();

  const handleAddModel = () => {
    setEditingProvider(undefined);
    setShowConfigModal(true);
  };

  const handleEditModel = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setShowConfigModal(true);
  };

  const handleSaveModel = (provider: LLMProvider) => {
    const newProviders = [...providers];
    const index = newProviders.findIndex(p => p.id === provider.id);
    if (index > -1) {
      newProviders[index] = provider;
    } else {
      newProviders.push(provider);
    }
    onUpdateProviders(newProviders);
    setShowConfigModal(false);
  };

  return (
    <div className="provider-settings-overlay" onClick={onClose}>
      <div className="provider-settings" onClick={(e) => e.stopPropagation()}>
        <div className="provider-settings-header">
          <h2>Providers</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="provider-settings-actions">
          <button onClick={handleAddModel}>+ Add Provider</button>
          <button>Scan for Local Models</button>
        </div>
        <div className="provider-list">
          {providers.map(p => (
            <ModelCard 
              key={p.id} 
              participant={{ 
                id: p.id, 
                provider: p, 
                modelName: p.config.modelName || '', 
                displayName: p.config.displayName || p.name, 
                color: '#ccc', 
                isActive: p.isActive, 
                addedAt: p.createdAt 
              }}
              status={providerStatuses.get(p.id)}
              onEdit={() => handleEditModel(p)}
              onRemove={() => onUpdateProviders(providers.filter(prov => prov.id !== p.id))}
              onToggle={() => {
                const newProviders = providers.map(prov => prov.id === p.id ? { ...prov, isActive: !prov.isActive } : prov);
                onUpdateProviders(newProviders);
              }}
            />
          ))}
        </div>
        {showConfigModal && (
          <ModelConfigModal 
            provider={editingProvider}
            onSave={handleSaveModel}
            onCancel={() => setShowConfigModal(false)}
          />
        )}
      </div>
    </div>
  );
};
