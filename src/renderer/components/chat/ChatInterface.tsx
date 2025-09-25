import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage, ModelParticipant } from '../../../types/chat';
import ConversationHistory from './ConversationHistory';
import MessageInput from './MessageInput';
import { ErrorBoundary, ErrorDisplay, EmptyState } from '../common/ErrorBoundary';
import { LoadingOverlay, Spinner } from '../common/LoadingStates';
import './ChatInterface.css';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  participants: ModelParticipant[];
  onSendMessage: (message: string, taskId?: string) => void;
  onRetryMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onExportConversation?: (format: 'json' | 'markdown' | 'text') => void;
  onClearConversation?: () => void;
  onAddParticipant?: () => void;
  onRemoveParticipant?: (participantId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string;
  conversationId?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  participants,
  onSendMessage,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onExportConversation,
  onClearConversation,
  onAddParticipant,
  onRemoveParticipant,
  isLoading = false,
  disabled = false,
  error,
  conversationId
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = useCallback((message: string, taskId?: string) => {
    onSendMessage(message, taskId);
    setAutoScroll(true); // Re-enable auto-scroll when user sends a message
  }, [onSendMessage]);

  const handleRetryMessage = useCallback((messageId: string) => {
    if (onRetryMessage) {
      onRetryMessage(messageId);
    }
  }, [onRetryMessage]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (onDeleteMessage) {
      onDeleteMessage(messageId);
      setSelectedMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  }, [onDeleteMessage]);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    if (onEditMessage) {
      onEditMessage(messageId, newContent);
    }
  }, [onEditMessage]);

  const handleExportConversation = useCallback(async (format: 'json' | 'markdown' | 'text') => {
    if (onExportConversation) {
      setIsExporting(true);
      try {
        await onExportConversation(format);
      } finally {
        setIsExporting(false);
      }
    }
  }, [onExportConversation]);

  const handleClearConversation = useCallback(() => {
    if (onClearConversation && window.confirm('Are you sure you want to clear this conversation? This action cannot be undone.')) {
      onClearConversation();
      setSelectedMessages(new Set());
    }
  }, [onClearConversation]);

  const handleSelectMessage = useCallback((messageId: string, selected: boolean) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(messageId);
      } else {
        newSet.delete(messageId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllMessages = useCallback(() => {
    setSelectedMessages(new Set(messages.map(m => m.id)));
  }, [messages]);

  const handleDeselectAllMessages = useCallback(() => {
    setSelectedMessages(new Set());
  }, []);

  const getPlaceholderText = () => {
    if (disabled) return "Chat is disabled";
    if (error) return "Error occurred - please check connection";
    if (participants.length === 0) return "Add some LLM models to start chatting...";
    if (participants.length === 1) return `Chat with ${participants[0].displayName}...`;
    return `Chat with ${participants.length} models...`;
  };

  const getActiveParticipants = () => participants.filter(p => p.isActive);
  const getInactiveParticipants = () => participants.filter(p => !p.isActive);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            if (event.shiftKey) {
              event.preventDefault();
              handleSelectAllMessages();
            }
            break;
          case 'd':
            if (event.shiftKey) {
              event.preventDefault();
              handleDeselectAllMessages();
            }
            break;
          case 'e':
            if (event.shiftKey && onExportConversation) {
              event.preventDefault();
              handleExportConversation('markdown');
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAllMessages, handleDeselectAllMessages, handleExportConversation, onExportConversation]);

  // Show empty state if no participants and no messages
  if (participants.length === 0 && messages.length === 0) {
    return (
      <ErrorBoundary>
        <div className="chat-interface" role="region" aria-label="Chat interface">
          <EmptyState
            title="No Models Added"
            description="Add some LLM models to start your multi-model conversation."
            icon="🤖"
            action={onAddParticipant ? {
              label: "Add Models",
              onClick: onAddParticipant
            } : undefined}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="chat-interface" ref={chatRef} role="region" aria-label="Chat interface">
        <LoadingOverlay isLoading={isExporting} text="Exporting conversation..." />
        
        <header className="chat-header" role="banner">
          <h1 className="chat-title">Conversation</h1>
          <div className="chat-actions">
              <button
                className="action-button"
                onClick={() => setShowActions(!showActions)}
                aria-label="Show chat actions"
                title="Chat actions"
              >
                {/* Icon for actions */}
              </button>
              {/* Dropdown menu logic remains the same */}
          </div>
        </header>

        {error && (
          <ErrorDisplay
            error={error}
            title="Chat Error"
            variant="banner"
            onDismiss={() => {/* Handle error dismissal if needed */}}
          />
        )}
        
        <ConversationHistory
          messages={messages}
          participants={participants}
          isLoading={isLoading}
          autoScroll={autoScroll}
          selectedMessages={selectedMessages}
          onSelectMessage={handleSelectMessage}
          onRetryMessage={handleRetryMessage}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
        />
        
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={disabled || getActiveParticipants().length === 0}
          placeholder={getPlaceholderText()}
          isLoading={isLoading}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ChatInterface;