import React, { useMemo, useState } from 'react';
import './ParticipantSidebar.css';

export interface SidebarParticipant {
  id: string;
  name: string;
  type: string;
  color: string;
  isActive: boolean;
}

interface ParticipantSidebarProps {
  participants: SidebarParticipant[];
  isCollapsed: boolean;
  activeTurnId: string | null;
  turnQueue: string[];
  isLoading: boolean;
  onToggleCollapse: () => void;
  onToggleParticipant: (id: string) => void;
  onOpenSettings: () => void;
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'api':
      return 'Cloud API';
    case 'ollama':
      return 'Ollama Local';
    case 'lmstudio':
      return 'LM Studio Local';
    default:
      return type;
  }
};

export const ParticipantSidebar: React.FC<ParticipantSidebarProps> = ({
  participants,
  isCollapsed,
  activeTurnId,
  turnQueue,
  isLoading,
  onToggleCollapse,
  onToggleParticipant,
  onOpenSettings,
}) => {
  const [expanded, setExpanded] = useState({ active: true, inactive: true });

  const activeParticipants = useMemo(
    () => participants.filter((participant) => participant.isActive),
    [participants]
  );
  const inactiveParticipants = useMemo(
    () => participants.filter((participant) => !participant.isActive),
    [participants]
  );

  const queueParticipants = useMemo(
    () => turnQueue
      .map((id) => participants.find((participant) => participant.id === id))
      .filter((participant): participant is SidebarParticipant => Boolean(participant)),
    [turnQueue, participants]
  );

  const renderParticipant = (participant: SidebarParticipant) => {
    const isCurrentTurn = activeTurnId ? participant.id === activeTurnId : queueParticipants[0]?.id === participant.id;
    const isQueued = queueParticipants.some((queued) => queued.id === participant.id);

    return (
      <div
        key={participant.id}
        className={`participant-card ${participant.isActive ? 'participant-card--active' : 'participant-card--inactive'}${
          isCurrentTurn ? ' participant-card--current' : ''
        }`}
      >
        <div className="participant-card__avatar" style={{ backgroundColor: participant.color }}>
          {participant.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="participant-card__details">
          <div className="participant-card__name">{participant.name}</div>
          <div className="participant-card__meta">
            <span>{getTypeLabel(participant.type)}</span>
            {isQueued && (
              <span className="participant-card__badge" aria-label="Queued to speak">
                {isCurrentTurn ? 'Speaking' : 'Queued'}
              </span>
            )}
          </div>
        </div>
        <div className="participant-card__actions">
          <button
            type="button"
            className="participant-card__toggle"
            onClick={() => onToggleParticipant(participant.id)}
          >
            {participant.isActive ? 'Pause' : 'Activate'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside className={`participant-sidebar${isCollapsed ? ' participant-sidebar--collapsed' : ''}`}>
      <div className="participant-sidebar__header">
        <div className="participant-sidebar__title-group">
          <h2 className="participant-sidebar__title">Participants</h2>
          {!isCollapsed && (
            <p className="participant-sidebar__subtitle">
              Manage who joins the conversation and monitor their status.
            </p>
          )}
        </div>
        <button
          type="button"
          className="participant-sidebar__collapse"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand participant sidebar' : 'Collapse participant sidebar'}
        >
          {isCollapsed ? '»' : '«'}
        </button>
      </div>

      {isCollapsed ? (
        <div className="participant-sidebar__collapsed-list" aria-hidden={!isCollapsed}>
          {activeParticipants.slice(0, 4).map((participant) => (
            <div
              key={participant.id}
              className={`participant-dot${activeTurnId === participant.id ? ' participant-dot--active' : ''}`}
              style={{ backgroundColor: participant.color }}
              title={`${participant.name} (${getTypeLabel(participant.type)})`}
            />
          ))}
          {activeParticipants.length > 4 && (
            <div className="participant-dot participant-dot--more">+{activeParticipants.length - 4}</div>
          )}
        </div>
      ) : (
        <div className="participant-sidebar__body">
          <section className="participant-section">
            <button
              type="button"
              className="participant-section__header"
              onClick={() => setExpanded((prev) => ({ ...prev, active: !prev.active }))}
              aria-expanded={expanded.active}
            >
              <span>Active ({activeParticipants.length})</span>
              <span className="chevron">{expanded.active ? '▾' : '▸'}</span>
            </button>
            {expanded.active && (
              <div className="participant-section__content">
                {activeParticipants.length === 0 ? (
                  <p className="participant-empty">No active models</p>
                ) : (
                  activeParticipants.map(renderParticipant)
                )}
              </div>
            )}
          </section>

          <section className="participant-section">
            <button
              type="button"
              className="participant-section__header"
              onClick={() => setExpanded((prev) => ({ ...prev, inactive: !prev.inactive }))}
              aria-expanded={expanded.inactive}
            >
              <span>Inactive ({inactiveParticipants.length})</span>
              <span className="chevron">{expanded.inactive ? '▾' : '▸'}</span>
            </button>
            {expanded.inactive && (
              <div className="participant-section__content">
                {inactiveParticipants.length === 0 ? (
                  <p className="participant-empty">All models active</p>
                ) : (
                  inactiveParticipants.map(renderParticipant)
                )}
              </div>
            )}
          </section>

          <div className="participant-sidebar__footer">
            <button type="button" className="participant-manage-button" onClick={onOpenSettings}>
              Manage Providers
            </button>
            <div className="participant-sidebar__hint">
              {isLoading ? 'Responses in progress…' : 'Start a conversation to engage these models.'}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
