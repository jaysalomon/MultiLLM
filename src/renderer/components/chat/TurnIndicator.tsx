import React from 'react';
import './TurnIndicator.css';

export interface TurnIndicatorParticipant {
  id: string;
  name: string;
  color: string;
}

interface TurnIndicatorProps {
  participants: TurnIndicatorParticipant[];
  activeTurnId: string | null;
  queue: string[];
  isLoading: boolean;
}

export const TurnIndicator: React.FC<TurnIndicatorProps> = ({
  participants,
  activeTurnId,
  queue,
  isLoading,
}) => {
  const queueParticipants = queue
    .map((id) => participants.find((participant) => participant.id === id))
    .filter((participant): participant is TurnIndicatorParticipant => Boolean(participant));

  if (queueParticipants.length === 0) {
    return (
      <div className="turn-indicator" aria-live="polite">
        <span className="turn-indicator__label">No active participants</span>
      </div>
    );
  }

  const currentTurnId = activeTurnId ?? queueParticipants[0]?.id;

  return (
    <div className="turn-indicator" aria-live="polite">
      <span className="turn-indicator__label">
        {isLoading ? 'Conversation in progress' : 'Ready order'}
      </span>
      <div className="turn-indicator__chips">
        {queueParticipants.map((participant, index) => {
          const isActive = participant.id === currentTurnId;
          return (
            <span
              key={participant.id}
              className={`turn-chip${isActive ? ' turn-chip--active' : ''}`}
              style={{ borderColor: participant.color }}
            >
              <span className="turn-chip__dot" style={{ backgroundColor: participant.color }} aria-hidden="true" />
              <span className="turn-chip__name">{participant.name}</span>
              {isLoading && isActive && <span className="turn-chip__pulse" aria-hidden="true" />}
              <span className="turn-chip__index" aria-hidden="true">{index + 1}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
