import React from 'react';
import { ChatMessage } from '../../../types/chat';
import { MessageFeedback } from './MessageFeedback';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: ChatMessage;
  isUser?: boolean;
  modelColor?: string;
  modelAvatar?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isUser = false,
  modelColor = '#3498db',
  modelAvatar
}) => {
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

  return (
    <article
      className={`message-bubble ${isUser ? 'user-message' : 'model-message'}`}
      role="article"
      aria-label={`Message from ${getDisplayName()} at ${formatTimestamp(message.timestamp)}`}
    >
      <header className="message-header">
        <div className="message-avatar" style={{ backgroundColor: isUser ? '#2c3e50' : modelColor }}>
          {modelAvatar ? (
            <img src={modelAvatar} alt={`${getDisplayName()} avatar`} />
          ) : (
            <span className="avatar-initials" aria-hidden="true">{getInitials(getDisplayName())}</span>
          )}
        </div>
        <div className="message-info">
          <span className="message-sender" aria-label={`Sender: ${getDisplayName()}`}>{getDisplayName()}</span>
          <time className="message-timestamp" dateTime={message.timestamp.toISOString()}>
            {formatTimestamp(message.timestamp)}
          </time>
          {message.metadata?.processingTime && (
            <span className="processing-time" aria-label={`Processing time: ${message.metadata.processingTime} milliseconds`}>
              {message.metadata.processingTime}ms
            </span>
          )}
        </div>
      </header>
      <div className="message-content" role="text">
        {message.content}
      </div>
      {!isUser && (
        <MessageFeedback 
          messageId={message.id} 
          onFeedback={(feedback) => console.log('Feedback:', feedback)} 
        />
      )}
      {message.metadata?.error && (
        <div className="message-error" role="alert">
          <span className="error-icon" aria-hidden="true">⚠️</span>
          <span className="error-text">{message.metadata.error}</span>
        </div>
      )}
    </article>
  );
};

export default MessageBubble;