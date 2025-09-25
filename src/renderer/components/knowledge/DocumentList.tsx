import React from 'react';
import { Document } from './KnowledgeSidebar';

interface DocumentListProps {
  documents: Document[];
  selectedDocumentId: string | null;
  onSelect: (documentId: string) => void;
  onDelete: (documentId: string) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  selectedDocumentId,
  onSelect,
  onDelete,
}) => {
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string): string => {
    const iconMap: Record<string, string> = {
      '.pdf': '📄',
      '.doc': '📝',
      '.docx': '📝',
      '.txt': '📃',
      '.md': '📋',
      '.json': '📊',
      '.csv': '📊',
      '.html': '🌐',
      '.xml': '📰',
    };
    return iconMap[fileType] || '📎';
  };

  if (documents.length === 0) {
    return (
      <div className="document-list-empty">
        <div className="empty-icon">📚</div>
        <p>No documents in knowledge base</p>
        <p className="hint">Click "Add Document" to get started</p>
      </div>
    );
  }

  return (
    <div className="document-list">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`document-item ${selectedDocumentId === doc.id ? 'selected' : ''}`}
          onClick={() => onSelect(doc.id)}
        >
          <div className="document-icon">
            {getFileIcon(doc.type)}
          </div>

          <div className="document-info">
            <div className="document-name">{doc.name}</div>
            <div className="document-meta">
              <span className="meta-item">
                {doc.chunks} chunks
              </span>
              <span className="meta-separator">•</span>
              <span className="meta-item">
                {formatFileSize(doc.size)}
              </span>
              <span className="meta-separator">•</span>
              <span className="meta-item">
                {formatDate(doc.updatedAt)}
              </span>
            </div>

            {doc.metadata.keywords && doc.metadata.keywords.length > 0 && (
              <div className="document-keywords">
                {doc.metadata.keywords.slice(0, 3).map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">
                    {keyword}
                  </span>
                ))}
                {doc.metadata.keywords.length > 3 && (
                  <span className="keyword-more">
                    +{doc.metadata.keywords.length - 3}
                  </span>
                )}
              </div>
            )}

            {doc.metadata.summary && (
              <div className="document-summary">
                {doc.metadata.summary.substring(0, 100)}
                {doc.metadata.summary.length > 100 && '...'}
              </div>
            )}
          </div>

          <div className="document-actions">
            <button
              className="action-button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${doc.name}"?`)) {
                  onDelete(doc.id);
                }
              }}
              title="Delete document"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
