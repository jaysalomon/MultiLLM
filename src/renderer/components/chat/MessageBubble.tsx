import React from 'react';
import { ChatMessage } from '../../../types/chat';
import { MessageFeedback } from './MessageFeedback';
import './MessageBubble.css';

// ... (props interface remains the same)

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isUser = false, modelColor, modelAvatar }) => {
  // ... (helper functions remain the same)

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'model'}`}>
      {!isUser && <div className="message-avatar" style={{ backgroundColor: modelColor }}>{/* Avatar logic */}</div>}
      <div className="message-container">
        <div className="message-header">{getDisplayName()}</div>
        <div className="message-content">
          {message.content}
        </div>
        <div className="message-footer">
          {/* Footer content like timestamp or feedback can go here */}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;