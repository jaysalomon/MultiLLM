import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, ModelParticipant } from '../../../types/chat';
import MessageBubble from './MessageBubble';
import './ConversationHistory.css';

interface ConversationHistoryProps {
  messages: ChatMessage[];
  participants: ModelParticipant[];
  isLoading?: boolean;
  autoScroll?: boolean;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  messages,
  participants,
  isLoading = false,
  autoScroll = true
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto' 
    });
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll]);

  const getParticipantInfo = (senderId: string) => {
    if (senderId === 'user') return null;
    return participants.find(p => p.id === senderId || p.modelName === senderId);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString();
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach(message => {
      const dateKey = formatDate(message.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (messages.length === 0) {
    return (
      <div className="conversation-history empty" role="region" aria-label="Conversation history">
        <div className="empty-state" role="status">
          <div className="empty-icon" aria-hidden="true">💬</div>
          <h3>Start a conversation</h3>
          <p>Send a message to begin chatting with your LLM models</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="conversation-history"
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Conversation history"
      aria-live="polite"
      tabIndex={0}
    >
      <div className="messages-container">
        {Object.entries(messageGroups).map(([date, dateMessages]) => (
          <div key={date} className="message-group" role="group" aria-label={`Messages from ${date}`}>
            <div className="date-separator" role="separator">
              <span className="date-label" aria-label={`Date: ${date}`}>{date}</span>
            </div>
            {dateMessages.map((message) => {
              const participant = getParticipantInfo(message.sender);
              const isUser = message.sender === 'user';
              
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isUser={isUser}
                  modelColor={participant?.color}
                  modelAvatar={participant?.avatar}
                />
              );
            })}
          </div>
        ))}
        
        {isLoading && (
          <div className="loading-indicator" role="status" aria-live="assertive">
            <div className="loading-dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="loading-text">Models are thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {showScrollButton && (
        <button
          className="scroll-to-bottom"
          onClick={() => scrollToBottom()}
          aria-label="Scroll to bottom of conversation"
          title="Scroll to bottom"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </button>
      )}
    </div>
  );
};

export default ConversationHistory;