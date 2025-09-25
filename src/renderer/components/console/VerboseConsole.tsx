import React, { useEffect, useMemo, useRef } from 'react';
import type { ConsoleLogEntry } from '../../types/console';
import './VerboseConsole.css';

interface VerboseConsoleProps {
  logs: ConsoleLogEntry[];
  isCollapsed: boolean;
  onToggle: () => void;
  onClear: () => void;
}

const levelLabels: Record<string, { label: string; icon: string }> = {
  info: { label: 'info', icon: 'ℹ️' },
  warn: { label: 'warn', icon: '⚠️' },
  error: { label: 'error', icon: '⛔' },
  debug: { label: 'debug', icon: '🛠️' },
};

const formatTimestamp = (date: Date): string => {
  try {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
};

const VerboseConsole: React.FC<VerboseConsoleProps> = ({ logs, isCollapsed, onToggle, onClear }) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCollapsed || !bodyRef.current) {
      return;
    }

    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs, isCollapsed]);

  const emptyState = useMemo(() => (
    <div className="verbose-console__empty">
      <span role="img" aria-label="sparkles">✨</span>
      <p>No activity yet. Interact with the models to populate verbose output.</p>
    </div>
  ), []);

  return (
    <div className={`verbose-console${isCollapsed ? ' verbose-console--collapsed' : ''}`}>
      <div className="verbose-console__header">
        <div className="verbose-console__title">
          <span>Verbose Console</span>
          <span className="verbose-console__badge" aria-label={`Total log entries ${logs.length}`}>{logs.length}</span>
        </div>
        <div className="verbose-console__actions">
          <button className="console-button" type="button" onClick={onToggle}>
            {isCollapsed ? 'Show Console' : 'Hide Console'}
          </button>
          <button className="console-button console-button--danger" type="button" onClick={onClear} disabled={logs.length === 0}>
            Clear
          </button>
        </div>
      </div>

      <div className="verbose-console__body" ref={bodyRef} role="log" aria-live="polite">
        {logs.length === 0 ? emptyState : logs.map((entry) => {
          const level = levelLabels[entry.level] ?? levelLabels.info;
          return (
            <div key={entry.id} className={`verbose-console__entry verbose-console__entry--${entry.level}`}>
              <div className="verbose-console__entry-header">
                <span className="verbose-console__entry-time">{formatTimestamp(entry.timestamp)}</span>
                <span className="verbose-console__entry-level">
                  <span className="verbose-console__entry-icon" aria-hidden="true">{level.icon}</span>
                  {level.label.toUpperCase()}
                </span>
              </div>
              <div className="verbose-console__entry-message">{entry.message}</div>
              {entry.context && (
                <pre className="verbose-console__entry-context">
                  {JSON.stringify(entry.context, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VerboseConsole;
