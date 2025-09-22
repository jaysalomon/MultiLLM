import React from 'react';
import { ModelParticipant, ProviderStatus } from '../../../types';
import { ModelStatusIndicator } from './ModelStatusIndicator';
import './ModelCard.css';

export interface ModelCardProps {
  participant: ModelParticipant;
  status?: ProviderStatus;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  isDraggedOver?: boolean;
  isDragging?: boolean;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  participant,
  status,
  onToggle,
  onEdit,
  onRemove,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDraggedOver = false,
  isDragging = false
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div
      data-testid="model-card"
      className={`model-card ${participant.isActive ? 'model-card--active' : 'model-card--inactive'} ${
        isDraggedOver ? 'model-card--drag-over' : ''
      } ${isDragging ? 'model-card--dragging' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {draggable && (
        <div className="model-card__drag-handle" title="Drag to reorder">
          <span className="model-card__drag-icon">⋮⋮</span>
        </div>
      )}

      <div className="model-card__content">
        <div className="model-card__header">
          <div className="model-card__identity">
            <div 
              className="model-card__avatar"
              style={{ backgroundColor: participant.color }}
            >
              {participant.avatar || participant.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="model-card__info">
              <h4 className="model-card__name">{participant.displayName}</h4>
              <p className="model-card__provider">
                {participant.provider.name} ({participant.provider.type})
              </p>
            </div>
          </div>
          
          <ModelStatusIndicator 
            status={status}
            isActive={participant.isActive}
          />
        </div>

        <div className="model-card__actions">
          <button
            className={`model-card__toggle ${
              participant.isActive ? 'model-card__toggle--active' : 'model-card__toggle--inactive'
            }`}
            onClick={onToggle}
            onKeyDown={(e) => handleKeyDown(e, onToggle)}
            title={participant.isActive ? 'Pause model' : 'Activate model'}
          >
            {participant.isActive ? 'Active' : 'Paused'}
          </button>

          <button
            className="model-card__action model-card__action--edit"
            onClick={onEdit}
            onKeyDown={(e) => handleKeyDown(e, onEdit)}
            title="Edit model configuration"
          >
            <span className="model-card__action-icon">✏️</span>
            <span className="model-card__action-text">Edit</span>
          </button>

          <button
            className="model-card__action model-card__action--remove"
            onClick={onRemove}
            onKeyDown={(e) => handleKeyDown(e, onRemove)}
            title="Remove model"
          >
            <span className="model-card__action-icon">🗑️</span>
            <span className="model-card__action-text">Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelCard;