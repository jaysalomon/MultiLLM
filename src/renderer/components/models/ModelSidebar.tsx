import React, { useState } from 'react';
import { ModelParticipant, ProviderStatus } from '../../../types';
import './ModelSidebar.css';

export type ModelSidebarProps = {
  participants?: ModelParticipant[];
  providerStatuses?: Map<string, ProviderStatus>;
  isCollapsed?: boolean;
  onAddModel?: () => void;
  onRemoveModel?: (id: string) => void;
  onToggleModel?: (id: string) => void;
  onUpdateModel?: (id: string, data: any) => void;
  onReorderModels?: (ids: string[]) => void;
  onToggleCollapse?: () => void;
};

export const ModelSidebar: React.FC<ModelSidebarProps> = ({
  participants = [],
  providerStatuses = new Map<string, ProviderStatus>(),
  isCollapsed = false,
  onAddModel = () => {},
  onRemoveModel = () => {},
  onToggleModel = () => {},
  onToggleCollapse = () => {},
}) => {
  const [showModal, setShowModal] = useState(false);

  const activeCount = participants.filter((p) => p.isActive).length;
  const inactiveCount = participants.length - activeCount;

  return (
    <div className="model-sidebar">
      {!isCollapsed ? (
        <div>
          <h2>Models</h2>
          <button onClick={() => { setShowModal(true); onAddModel(); }}>Add Model</button>

          <h3>Active Models ({activeCount})</h3>
          <h3>Inactive Models ({inactiveCount})</h3>

          <ul>
            {participants.map((p) => (
              <li key={p.id}>
                <span>{p.displayName}</span>
                <button title="Toggle model activation" onClick={() => onToggleModel(p.id)}>Toggle</button>
                <button title="Remove model" onClick={() => onRemoveModel(p.id)}>Remove</button>
                {/* provider status */}
                {providerStatuses && providerStatuses.get(p.id) && providerStatuses.get(p.id)!.isConnected && (
                  <span title={`Connected (${providerStatuses.get(p.id)!.latency}ms)`}>●</span>
                )}
                {providerStatuses && providerStatuses.get(p.id) && providerStatuses.get(p.id)!.error && (
                  <span title={`Error: ${providerStatuses.get(p.id)!.error}`}>!</span>
                )}
              </li>
            ))}
          </ul>

          {showModal && (
            <div data-testid="model-config-modal">Model Config Modal</div>
          )}
        </div>
      ) : (
        <div>
          <button title="Expand model sidebar" onClick={onToggleCollapse}>Expand</button>
        </div>
      )}

      <button title="Collapse model sidebar" onClick={onToggleCollapse}>Collapse</button>
    </div>
  );
};

export default ModelSidebar;