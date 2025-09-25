import React, { useState, useRef } from 'react';

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  acceptedFormats?: string[];
  maxFileSize?: number; // in bytes
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  isUploading,
  uploadProgress,
  acceptedFormats = ['.txt', '.md', '.pdf', '.doc', '.docx', '.json'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check file extension
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (acceptedFormats.length > 0 && !acceptedFormats.includes(extension)) {
        errors.push(`${file.name}: Unsupported file format`);
        continue;
      }

      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File too large (max ${Math.round(maxFileSize / 1024 / 1024)}MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    setSelectedFiles(validFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    await onUpload(selectedFiles);
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-container">
      <div
        className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFormats.join(',')}
          onChange={handleFileInput}
          disabled={isUploading}
          style={{ display: 'none' }}
        />

        <div className="drop-zone-content">
          <div className="upload-icon">📁</div>
          <p className="drop-zone-text">
            {dragActive
              ? 'Drop files here'
              : 'Drag & drop files here or click to browse'}
          </p>
          <p className="drop-zone-hint">
            Supported formats: {acceptedFormats.join(', ')}
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <h4>Selected Files</h4>
          <div className="file-list">
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                {!isUploading && (
                  <button
                    className="remove-file"
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="progress-text">Uploading... {Math.round(uploadProgress)}%</p>
        </div>
      )}

      {selectedFiles.length > 0 && !isUploading && (
        <div className="upload-actions">
          <button
            className="cancel-button"
            onClick={() => setSelectedFiles([])}
          >
            Cancel
          </button>
          <button
            className="upload-button"
            onClick={handleUpload}
          >
            Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
};
