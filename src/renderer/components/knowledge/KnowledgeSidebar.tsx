import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './FileUpload';
import { DocumentList } from './DocumentList';
import './Knowledge.css';

export interface Document {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  chunks: number;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    wordCount: number;
    language?: string;
    keywords?: string[];
    summary?: string;
  };
}

interface KnowledgeSidebarProps {
  onDocumentSelect?: (documentId: string) => void;
  onSearch?: (query: string) => void;
}

export const KnowledgeSidebar: React.FC<KnowledgeSidebarProps> = ({
  onDocumentSelect,
  onSearch,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalChunks: 0,
    totalTokens: 0,
  });
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await window.electron.knowledge.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadStats = async () => {
    try {
      const knowledgeStats = await window.electron.knowledge.getStats();
      setStats(knowledgeStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress((i / files.length) * 100);

        // Upload file
        await window.electron.knowledge.addDocument(file.path);

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      // Reload documents
      await loadDocuments();
      await loadStats();

      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed to upload documents:', error);
      alert(`Upload failed: ${error}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await window.electron.knowledge.deleteDocument(documentId);
      await loadDocuments();
      await loadStats();

      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(null);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert(`Failed to delete document: ${error}`);
    }
  };

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (onSearch) {
        onSearch(query);
      }
    },
    [onSearch]
  );

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocumentId(documentId);
    if (onDocumentSelect) {
      onDocumentSelect(documentId);
    }
  };

  const handleRefresh = async () => {
    await loadDocuments();
    await loadStats();
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.metadata.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="knowledge-sidebar">
      <div className="knowledge-sidebar-header">
        <h2>Knowledge Base</h2>
        <div className="knowledge-actions">
          <button
            className="icon-button"
            onClick={handleRefresh}
            title="Refresh"
          >
            🔄
          </button>
          <button
            className="primary-button"
            onClick={() => setShowUploadModal(true)}
          >
            + Add Document
          </button>
        </div>
      </div>

      <div className="knowledge-stats">
        <div className="stat">
          <span className="stat-value">{stats.totalDocuments}</span>
          <span className="stat-label">Documents</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.totalChunks}</span>
          <span className="stat-label">Chunks</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {Math.round(stats.totalTokens / 1000)}k
          </span>
          <span className="stat-label">Tokens</span>
        </div>
      </div>

      <div className="knowledge-search">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <DocumentList
        documents={filteredDocuments}
        selectedDocumentId={selectedDocumentId}
        onSelect={handleDocumentSelect}
        onDelete={handleDelete}
      />

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Documents</h3>
              {!isUploading && (
                <button
                  className="close-button"
                  onClick={() => setShowUploadModal(false)}
                >
                  ×
                </button>
              )}
            </div>

            <FileUpload
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              acceptedFormats={['.txt', '.md', '.pdf', '.doc', '.docx']}
            />
          </div>
        </div>
      )}
    </div>
  );
};