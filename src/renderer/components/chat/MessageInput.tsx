import React, { useState, useRef, useEffect } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, disabled = false, placeholder = "Type your message...", isLoading }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ... (handlers remain the same, but without taskId)

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            // ... (props remain the same)
          />
          <button type="submit" disabled={!message.trim() || disabled || isLoading} className="send-button">
            {/* Send Icon */}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;