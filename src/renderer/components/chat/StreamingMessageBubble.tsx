import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../../../types/chat';
import './StreamingMessageBubble.css';

interface StreamingMessageBubbleProps {
  message: ChatMessage & {
    isStreaming?: boolean;
    streamContent?: string;
    error?: string;
  };
  isUser?: boolean;
  modelColor?: string;
  modelAvatar?: string;
  onCancel?: () => void;
}

const StreamingMessageBubble: React.FC<StreamingMessageBubbleProps> = ({
  message,
  isUser = false,
  modelColor = '#3498db',
  modelAvatar,
  onCancel
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  // Auto-scroll content as it streams
  useEffect(() => {
    if (message.isStreaming && contentRef.current) {
      const element = contentRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [message.streamContent, message.isStreaming]);

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  };

  const getDisplayName = () => {
    if (isUser) return 'You';
    return message.metadata?.model || message.sender;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayContent = message.isStreaming
    ? (message.streamContent || '')
    : (message.content || '');

  return (
    <article
      className={`streaming-message-bubble ${isUser ? 'user-message' : 'model-message'} ${message.isStreaming ? 'streaming' : ''}`}
      role="article"
      aria-label={`${message.isStreaming ? 'Streaming' : ''} message from ${getDisplayName()} at ${formatTimestamp(message.timestamp)}`}
      aria-live={message.isStreaming ? 'polite' : 'off'}
    >
      <header className="message-header">
        <div className="message-avatar" style={{ backgroundColor: isUser ? '#2c3e50' : modelColor }}>
          {modelAvatar ? (
            <img src={modelAvatar} alt={`${getDisplayName()} avatar`} />
          ) : (
            <span className="avatar-initials" aria-hidden="true">
              {getInitials(getDisplayName())}
            </span>
          )}
        </div>
        <div className="message-info">
          <span className="message-sender" aria-label={`Sender: ${getDisplayName()}`}>
            {getDisplayName()}
          </span>
          <time className="message-timestamp" dateTime={message.timestamp.toISOString()}>
            {formatTimestamp(message.timestamp)}
          </time>
          {message.isStreaming && (
            <span className="streaming-indicator" aria-label="Streaming">
              <span className="streaming-dot"></span>
              <span className="streaming-dot"></span>
              <span className="streaming-dot"></span>
            </span>
          )}
          {message.metadata?.processingTime && !message.isStreaming && (
            <span
              className="processing-time"
              aria-label={`Processing time: ${message.metadata.processingTime} milliseconds`}
            >
              {message.metadata.processingTime}ms
            </span>
          )}
        </div>
        {message.isStreaming && onCancel && (
          <button
            className="cancel-stream-btn"
            onClick={onCancel}
            aria-label="Cancel streaming"
            title="Cancel streaming"
          >
            ✕
          </button>
        )}
      </header>

      <div className="message-content-wrapper">
        <div
          ref={contentRef}
          className="message-content"
          role="text"
        >
          {displayContent}
          {message.isStreaming && (
            <span ref={cursorRef} className="streaming-cursor" aria-hidden="true">▊</span>
          )}
        </div>

        {/* Token counter for streaming */}
        {message.isStreaming && displayContent && (
          <div className="streaming-stats" aria-live="off">
            <span className="token-count">
              ~{displayContent.split(' ').length} tokens
            </span>
          </div>
        )}
      </div>

      {message.error && (
        <div className="message-error" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <span className="error-text">{message.error}</span>
        </div>
      )}

      {/* Progress bar for streaming */}
      {message.isStreaming && (
        <div className="streaming-progress" aria-hidden="true">
          <div className="progress-bar"></div>
        </div>
      )}
    </article>
  );
};

export default StreamingMessageBubble;