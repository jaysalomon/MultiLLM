import React, { useState } from 'react';
import { useConversationPersistence } from '../../hooks/useConversationPersistence';
import './ConversationManager.css';

interface ConversationManagerProps {
  onConversationSelect?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

export const ConversationManager: React.FC<ConversationManagerProps> = ({
  onConversationSelect,
  onNewConversation
}) => {
  const {
    conversations,
    currentConversation,
    loading,
    error,
    createConversation,
    loadConversation,
    deleteConversation,
    exportConversation,
    refreshConversations,
    autoSave,
    setAutoSave
  } = useConversationPersistence();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'markdown' | 'text'>('json');

  const handleNewConversation = async () => {
    if (newTitle.trim()) {
      try {
        const id = await createConversation(newTitle);
        setNewTitle('');
        setShowNewDialog(false);
        if (onNewConversation) {
          onNewConversation();
        }
        if (onConversationSelect) {
          onConversationSelect(id);
        }
      } catch (err) {
        console.error('Failed to create conversation:', err);
      }
    }
  };

  const handleSelectConversation = async (id: string) => {
    await loadConversation(id);
    if (onConversationSelect) {
      onConversationSelect(id);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      await deleteConversation(id);
    }
  };

  const handleExportConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection
    await exportConversation(id, selectedFormat);
  };

  return (
    <div className="conversation-manager" role="navigation" aria-label="Conversation manager">
      <div className="conversation-header">
        <h2>Conversations</h2>
        <div className="conversation-actions">
          <button
            onClick={() => setShowNewDialog(true)}
            className="new-conversation-btn"
            aria-label="Create new conversation"
          >
            <span>+ New</span>
          </button>
          <button
            onClick={refreshConversations}
            className="refresh-btn"
            aria-label="Refresh conversations"
            disabled={loading}
          >
            🔄
          </button>
        </div>
      </div>

      <div className="auto-save-toggle">
        <label>
          <input
            type="checkbox"
            checked={autoSave}
            onChange={(e) => setAutoSave(e.target.checked)}
          />
          Auto-save conversations
        </label>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-message" role="status">
          Loading conversations...
        </div>
      )}

      <div className="conversation-list" role="list">
        {conversations.length === 0 ? (
          <div className="empty-state" role="status">
            No conversations yet. Start a new one!
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${currentConversation?.id === conv.id ? 'selected' : ''}`}
              onClick={() => handleSelectConversation(conv.id)}
              role="listitem"
              tabIndex={0}
              aria-selected={currentConversation?.id === conv.id}
            >
              <div className="conversation-info">
                <h3 className="conversation-title">{conv.title}</h3>
                <p className="conversation-date">
                  {new Date(conv.created_at).toLocaleDateString()}
                </p>
                {conv.summary && (
                  <p className="conversation-summary">{conv.summary}</p>
                )}
              </div>
              <div className="conversation-item-actions">
                <button
                  onClick={(e) => handleExportConversation(conv.id, e)}
                  className="export-btn"
                  aria-label={`Export ${conv.title}`}
                  title="Export conversation"
                >
                  📥
                </button>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="delete-btn"
                  aria-label={`Delete ${conv.title}`}
                  title="Delete conversation"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Conversation Dialog */}
      {showNewDialog && (
        <div className="dialog-overlay" onClick={() => setShowNewDialog(false)}>
          <div
            className="dialog-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-conversation-title"
          >
            <h3 id="new-conversation-title">New Conversation</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter conversation title..."
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleNewConversation();
                }
              }}
            />
            <div className="dialog-actions">
              <button onClick={() => setShowNewDialog(false)}>Cancel</button>
              <button onClick={handleNewConversation} disabled={!newTitle.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Format Selector */}
      <div className="export-format-selector">
        <label>Export format:</label>
        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value as 'json' | 'markdown' | 'text')}
        >
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
          <option value="text">Plain Text</option>
        </select>
      </div>
    </div>
  );
};