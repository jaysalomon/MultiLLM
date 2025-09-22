import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, ModelParticipant } from '../../../types/chat';
import MessageBubble from './MessageBubble';
import StreamingMessageBubble from './StreamingMessageBubble';
import './ConversationHistory.css';

interface StreamingMessage extends ChatMessage {
  isStreaming?: boolean;
  streamContent?: string;
  error?: string;
}

interface StreamingConversationHistoryProps {
  messages: ChatMessage[];
  streamingMessages?: Map<string, StreamingMessage>;
  participants: ModelParticipant[];
  isLoading?: boolean;
  autoScroll?: boolean;
  onCancelStream?: (messageId: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
}

const StreamingConversationHistory: React.FC<StreamingConversationHistoryProps> = ({
  messages,
  streamingMessages = new Map(),
  participants,
  isLoading = false,
  autoScroll = true,
  onCancelStream,
  onRetryMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasStreamingError, setHasStreamingError] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  }, []);

  // Check for streaming errors
  useEffect(() => {
    const hasError = Array.from(streamingMessages.values()).some(msg => msg.error);
    setHasStreamingError(hasError);
  }, [streamingMessages]);

  // Auto-scroll when new messages arrive or streaming updates
  useEffect(() => {
    if (autoScroll) {
      // Use requestAnimationFrame for smooth scrolling during streaming
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, streamingMessages, autoScroll, scrollToBottom]);

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

  // Combine regular messages with streaming messages
  const allMessages = [...messages];
  streamingMessages.forEach((streamMsg, id) => {
    // Only add if not already in messages
    if (!messages.find(m => m.id === id)) {
      allMessages.push(streamMsg);
    }
  });

  const messageGroups = groupMessagesByDate(allMessages);

  if (allMessages.length === 0) {
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

              // Check if this message is streaming
              const streamingMsg = streamingMessages.get(message.id);
              const isStreaming = streamingMsg?.isStreaming || false;

              // Use streaming bubble for streaming messages
              if (isStreaming || streamingMsg) {
                return (
                  <div key={message.id} className="message-wrapper">
                    <StreamingMessageBubble
                      message={streamingMsg || message}
                      isUser={isUser}
                      modelColor={participant?.color}
                      modelAvatar={participant?.avatar}
                      onCancel={onCancelStream ? () => onCancelStream(message.id) : undefined}
                    />
                    {streamingMsg?.error && onRetryMessage && (
                      <button
                        className="retry-button"
                        onClick={() => onRetryMessage(message)}
                        aria-label="Retry failed message"
                      >
                        🔄 Retry
                      </button>
                    )}
                  </div>
                );
              }

              // Regular message bubble
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

        {/* Loading indicator for initial requests */}
        {isLoading && streamingMessages.size === 0 && (
          <div className="loading-indicator" role="status" aria-live="assertive">
            <div className="loading-dots" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="loading-text">Preparing responses...</span>
          </div>
        )}

        {/* Streaming status indicator */}
        {streamingMessages.size > 0 && (
          <div className="streaming-status" role="status" aria-live="polite">
            <span className="streaming-count">
              {streamingMessages.size} model{streamingMessages.size !== 1 ? 's' : ''} responding...
            </span>
            {onCancelStream && (
              <button
                className="cancel-all-btn"
                onClick={() => {
                  streamingMessages.forEach((_, id) => onCancelStream(id));
                }}
                aria-label="Cancel all streams"
              >
                Cancel All
              </button>
            )}
          </div>
        )}

        {/* Error recovery notification */}
        {hasStreamingError && (
          <div className="error-notification" role="alert">
            <span>Some responses failed. You can retry them above.</span>
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
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        </button>
      )}
    </div>
  );
};

export default StreamingConversationHistory;