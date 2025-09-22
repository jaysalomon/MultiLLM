/**
 * UI indicators for LLM-to-LLM conversations
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React from 'react';
import type { ChatMessage, ModelParticipant } from '../../types/chat';
import type { MessageRouting, LLMConversationThread, ParsedMention } from '../../orchestrator/LLMCommunicationSystem';

/**
 * Props for mention highlight component
 * Requirements: 7.2
 */
interface MentionHighlightProps {
  content: string;
  mentions: ParsedMention[];
  participants: ModelParticipant[];
}

/**
 * Component to highlight @mentions in message content
 * Requirements: 7.2
 */
export const MentionHighlight: React.FC<MentionHighlightProps> = ({
  content,
  mentions,
  participants
}) => {
  if (mentions.length === 0) {
    return <span>{content}</span>;
  }

  // Sort mentions by start index to process them in order
  const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex);
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedMentions.forEach((mention, index) => {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>
          {content.slice(lastIndex, mention.startIndex)}
        </span>
      );
    }

    // Find participant for styling
    const participant = participants.find(p => p.id === mention.modelId);
    
    // Add highlighted mention
    parts.push(
      <span
        key={`mention-${index}`}
        className="mention-highlight"
        style={{
          backgroundColor: participant?.color ? `${participant.color}20` : '#007acc20',
          color: participant?.color || '#007acc',
          fontWeight: 'bold',
          padding: '2px 4px',
          borderRadius: '3px',
          border: `1px solid ${participant?.color || '#007acc'}40`
        }}
        title={`Mentioned: ${mention.displayName}`}
      >
        {mention.fullMention}
      </span>
    );

    lastIndex = mention.endIndex;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key="text-end">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
};

/**
 * Props for routing indicator component
 * Requirements: 7.1
 */
interface RoutingIndicatorProps {
  routing: MessageRouting;
  participants: ModelParticipant[];
  className?: string;
}

/**
 * Component to show message routing information
 * Requirements: 7.1
 */
export const RoutingIndicator: React.FC<RoutingIndicatorProps> = ({
  routing,
  participants,
  className = ''
}) => {
  const getRoutingIcon = () => {
    switch (routing.routingType) {
      case 'targeted':
        return '🎯';
      case 'reply':
        return '↩️';
      case 'broadcast':
        return '📢';
      default:
        return '💬';
    }
  };

  const getRoutingDescription = () => {
    const targetNames = routing.targetIds
      .map(id => participants.find(p => p.id === id)?.displayName || id)
      .join(', ');

    switch (routing.routingType) {
      case 'targeted':
        return `Targeted to: ${targetNames}`;
      case 'reply':
        return `Reply to: ${targetNames}`;
      case 'broadcast':
        return `Broadcast to all active models`;
      default:
        return 'Unknown routing';
    }
  };

  return (
    <div className={`routing-indicator ${className}`}>
      <span className="routing-icon" title={getRoutingDescription()}>
        {getRoutingIcon()}
      </span>
      <span className="routing-text">
        {getRoutingDescription()}
      </span>
    </div>
  );
};

/**
 * Props for thread indicator component
 * Requirements: 7.3
 */
interface ThreadIndicatorProps {
  thread: LLMConversationThread;
  participants: ModelParticipant[];
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Component to show conversation thread information
 * Requirements: 7.3
 */
export const ThreadIndicator: React.FC<ThreadIndicatorProps> = ({
  thread,
  participants,
  isActive = false,
  onClick,
  className = ''
}) => {
  const threadParticipants = thread.participantIds
    .map(id => participants.find(p => p.id === id))
    .filter(Boolean) as ModelParticipant[];

  const getThreadTypeIcon = () => {
    switch (thread.threadType) {
      case 'llm-to-llm':
        return '🤖';
      case 'user-initiated':
        return '👤';
      case 'mixed':
        return '👥';
      default:
        return '💬';
    }
  };

  const getThreadTypeLabel = () => {
    switch (thread.threadType) {
      case 'llm-to-llm':
        return 'AI Discussion';
      case 'user-initiated':
        return 'User Thread';
      case 'mixed':
        return 'Mixed Thread';
      default:
        return 'Thread';
    }
  };

  return (
    <div 
      className={`thread-indicator ${isActive ? 'active' : ''} ${className}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        padding: '8px 12px',
        border: `1px solid ${isActive ? '#007acc' : '#ddd'}`,
        borderRadius: '6px',
        backgroundColor: isActive ? '#007acc10' : '#f9f9f9',
        margin: '4px 0'
      }}
    >
      <div className="thread-header">
        <span className="thread-icon" title={getThreadTypeLabel()}>
          {getThreadTypeIcon()}
        </span>
        <span className="thread-type">{getThreadTypeLabel()}</span>
        <span className="thread-status">
          {thread.isActive ? '🟢' : '🔴'}
        </span>
      </div>
      
      <div className="thread-participants">
        <span className="participants-label">Participants: </span>
        {threadParticipants.map((participant, index) => (
          <span
            key={participant.id}
            className="participant-tag"
            style={{
              backgroundColor: `${participant.color}20`,
              color: participant.color,
              padding: '2px 6px',
              borderRadius: '12px',
              fontSize: '0.8em',
              marginRight: '4px',
              border: `1px solid ${participant.color}40`
            }}
          >
            {participant.displayName}
          </span>
        ))}
      </div>
      
      <div className="thread-stats">
        <span className="message-count">
          {thread.messages.length} messages
        </span>
        <span className="thread-time">
          Updated: {thread.updatedAt.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

/**
 * Props for LLM conversation badge
 * Requirements: 7.1, 7.3
 */
interface LLMConversationBadgeProps {
  message: ChatMessage;
  isLLMToLLM: boolean;
  threadId?: string;
  className?: string;
}

/**
 * Badge to indicate LLM-to-LLM conversation messages
 * Requirements: 7.1, 7.3
 */
export const LLMConversationBadge: React.FC<LLMConversationBadgeProps> = ({
  message,
  isLLMToLLM,
  threadId,
  className = ''
}) => {
  if (!isLLMToLLM) {
    return null;
  }

  return (
    <div className={`llm-conversation-badge ${className}`}>
      <span 
        className="badge-icon"
        title="LLM-to-LLM conversation"
        style={{
          backgroundColor: '#ff6b35',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '0.7em',
          fontWeight: 'bold',
          marginLeft: '8px'
        }}
      >
        🤖💬
      </span>
      {threadId && (
        <span 
          className="thread-id"
          title={`Thread: ${threadId}`}
          style={{
            fontSize: '0.7em',
            color: '#666',
            marginLeft: '4px'
          }}
        >
          #{threadId.slice(-6)}
        </span>
      )}
    </div>
  );
};

/**
 * Props for reply indicator component
 * Requirements: 7.3
 */
interface ReplyIndicatorProps {
  replyToMessage: ChatMessage;
  participants: ModelParticipant[];
  onClick?: () => void;
  className?: string;
}

/**
 * Component to show reply relationship
 * Requirements: 7.3
 */
export const ReplyIndicator: React.FC<ReplyIndicatorProps> = ({
  replyToMessage,
  participants,
  onClick,
  className = ''
}) => {
  const senderParticipant = participants.find(p => p.id === replyToMessage.sender);
  const senderName = senderParticipant?.displayName || replyToMessage.sender;
  const senderColor = senderParticipant?.color || '#666';

  return (
    <div 
      className={`reply-indicator ${className}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        padding: '4px 8px',
        backgroundColor: '#f0f0f0',
        borderLeft: `3px solid ${senderColor}`,
        borderRadius: '0 4px 4px 0',
        margin: '4px 0',
        fontSize: '0.9em',
        color: '#666'
      }}
    >
      <div className="reply-header">
        <span className="reply-icon">↩️</span>
        <span className="reply-to">
          Replying to <strong style={{ color: senderColor }}>{senderName}</strong>
        </span>
      </div>
      <div className="reply-preview" style={{ 
        fontStyle: 'italic',
        marginTop: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '300px'
      }}>
        "{replyToMessage.content.slice(0, 100)}{replyToMessage.content.length > 100 ? '...' : ''}"
      </div>
    </div>
  );
};

/**
 * Props for discussion context panel
 * Requirements: 7.4
 */
interface DiscussionContextPanelProps {
  threadId: string;
  context: {
    threadId: string;
    conversationHistory: ChatMessage[];
    activeParticipants: ModelParticipant[];
    discussionTopic?: string;
    contextSummary?: string;
    turnCount: number;
    lastActivity: Date;
  };
  onClose?: () => void;
  className?: string;
}

/**
 * Panel showing discussion context for multi-turn LLM conversations
 * Requirements: 7.4
 */
export const DiscussionContextPanel: React.FC<DiscussionContextPanelProps> = ({
  threadId,
  context,
  onClose,
  className = ''
}) => {
  return (
    <div className={`discussion-context-panel ${className}`} style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      backgroundColor: '#fafafa',
      margin: '8px 0'
    }}>
      <div className="context-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h4 style={{ margin: 0, color: '#333' }}>
          Discussion Context
        </h4>
        {onClose && (
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        )}
      </div>

      <div className="context-info">
        <div className="context-row" style={{ marginBottom: '8px' }}>
          <strong>Thread ID:</strong> {threadId}
        </div>
        
        {context.discussionTopic && (
          <div className="context-row" style={{ marginBottom: '8px' }}>
            <strong>Topic:</strong> {context.discussionTopic}
          </div>
        )}
        
        <div className="context-row" style={{ marginBottom: '8px' }}>
          <strong>Turn Count:</strong> {context.turnCount}
        </div>
        
        <div className="context-row" style={{ marginBottom: '8px' }}>
          <strong>Last Activity:</strong> {context.lastActivity.toLocaleString()}
        </div>
        
        <div className="context-row" style={{ marginBottom: '8px' }}>
          <strong>Active Participants:</strong>
          <div style={{ marginTop: '4px' }}>
            {context.activeParticipants.map(participant => (
              <span
                key={participant.id}
                style={{
                  backgroundColor: `${participant.color}20`,
                  color: participant.color,
                  padding: '2px 6px',
                  borderRadius: '12px',
                  fontSize: '0.8em',
                  marginRight: '4px',
                  border: `1px solid ${participant.color}40`
                }}
              >
                {participant.displayName}
              </span>
            ))}
          </div>
        </div>
        
        {context.contextSummary && (
          <div className="context-row">
            <strong>Summary:</strong>
            <div style={{ 
              marginTop: '4px',
              padding: '8px',
              backgroundColor: 'white',
              borderRadius: '4px',
              fontStyle: 'italic',
              color: '#555'
            }}>
              {context.contextSummary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};