import React, { useState, useCallback } from 'react';
import { ModelParticipant, LLMProvider, ProviderStatus } from '../../../types';
import { ModelCard } from './ModelCard';
import { AddModelButton } from './AddModelButton';
import { ModelConfigModal } from './ModelConfigModal';
import { BudgetMonitor } from './BudgetMonitor';
import './ModelSidebar.css';

export interface ModelSidebarProps {
  participants: ModelParticipant[];
  providerStatuses: Map<string, ProviderStatus>;
  onAddModel: (provider: LLMProvider) => void;
  onRemoveModel: (modelId: string) => void;
  onToggleModel: (modelId: string) => void;
  onUpdateModel: (modelId: string, updates: Partial<LLMProvider>) => void;
  onReorderModels: (reorderedParticipants: ModelParticipant[]) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ModelSidebar: React.FC<ModelSidebarProps> = ({
  participants,
  providerStatuses,
  onAddModel,
  onRemoveModel,
  onToggleModel,
  onUpdateModel,
  onReorderModels,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelParticipant | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const activeModels = participants.filter(p => p.isActive);
  const inactiveModels = participants.filter(p => !p.isActive);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    const reorderedParticipants = [...participants];
    const [draggedItem] = reorderedParticipants.splice(draggedIndex, 1);
    reorderedParticipants.splice(dropIndex, 0, draggedItem);
    
    onReorderModels(reorderedParticipants);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, participants, onReorderModels]);

  const handleEditModel = useCallback((participant: ModelParticipant) => {
    setEditingModel(participant);
    setShowConfigModal(true);
  }, []);

  const handleSaveModel = useCallback((provider: LLMProvider) => {
    if (editingModel) {
      onUpdateModel(editingModel.id, provider);
    } else {
      onAddModel(provider);
    }
    setShowConfigModal(false);
    setEditingModel(null);
  }, [editingModel, onAddModel, onUpdateModel]);

  const handleCancelEdit = useCallback(() => {
    setShowConfigModal(false);
    setEditingModel(null);
  }, []);

  if (isCollapsed) {
    return (
      <div className="model-sidebar model-sidebar--collapsed">
        <button 
          className="model-sidebar__toggle"
          onClick={onToggleCollapse}
          title="Expand model sidebar"
        >
          <span className="model-sidebar__toggle-icon">→</span>
        </button>
        <div className="model-sidebar__collapsed-indicators">
          {activeModels.map((participant, index) => (
            <div
              key={participant.id}
              className="model-sidebar__collapsed-indicator"
              style={{ backgroundColor: participant.color }}
              title={participant.displayName}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="model-sidebar">
      <div className="model-sidebar__header">
        <h2 className="model-sidebar__title">Models</h2>
        {onToggleCollapse && (
          <button 
            className="model-sidebar__toggle"
            onClick={onToggleCollapse}
            title="Collapse model sidebar"
          >
            <span className="model-sidebar__toggle-icon">←</span>
          </button>
        )}
      </div>

      <div className="model-sidebar__content">
        <AddModelButton 
          onClick={() => setShowConfigModal(true)}
          disabled={false}
        />

        {activeModels.length > 0 && (
          <div className="model-sidebar__section">
            <h3 className="model-sidebar__section-title">
              Active Models ({activeModels.length})
            </h3>
            <div className="model-sidebar__model-list">
              {activeModels.map((participant, index) => (
                <ModelCard
                  key={participant.id}
                  participant={participant}
                  status={providerStatuses.get(participant.provider.id)}
                  onToggle={() => onToggleModel(participant.id)}
                  onEdit={() => handleEditModel(participant)}
                  onRemove={() => onRemoveModel(participant.id)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  isDraggedOver={dragOverIndex === index}
                  isDragging={draggedIndex === index}
                />
              ))}
            </div>
          </div>
        )}

        {inactiveModels.length > 0 && (
          <div className="model-sidebar__section">
            <h3 className="model-sidebar__section-title">
              Inactive Models ({inactiveModels.length})
            </h3>
            <div className="model-sidebar__model-list">
              {inactiveModels.map((participant) => (
                <ModelCard
                  key={participant.id}
                  participant={participant}
                  status={providerStatuses.get(participant.provider.id)}
                  onToggle={() => onToggleModel(participant.id)}
                  onEdit={() => handleEditModel(participant)}
                  onRemove={() => onRemoveModel(participant.id)}
                />
              ))}
            </div>
          </div>
        )}

        {participants.length === 0 && (
          <div className="model-sidebar__empty">
            <p className="model-sidebar__empty-text">
              No models configured yet. Add your first model to get started!
            </p>
          </div>
        )}
      </div>

      {showConfigModal && (
        <ModelConfigModal
          provider={editingModel?.provider}
          onSave={handleSaveModel}
          onCancel={handleCancelEdit}
        />
      )}

      <BudgetMonitor />
      <div className="model-sidebar__section">
        <button onClick={() => window.electronAPI.openPerformanceDashboard()}>Performance Dashboard</button>
      </div>
    </div>
  );
};

export default ModelSidebar;