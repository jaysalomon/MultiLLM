import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { KnowledgeBase } from '../services/KnowledgeBase';
import { DocumentManager } from '../services/DocumentManager';
import { DatabaseManager } from '../database/DatabaseManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

jest.mock('../services/DocumentManager');

describe('KnowledgeBase', () => {
  let knowledgeBase: KnowledgeBase;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockDocumentManager: jest.Mocked<DocumentManager>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `kb-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    mockDbManager = {} as any;

    mockDocumentManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      addDocument: jest.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'test.txt',
        chunks: [
          {
            id: 'chunk-1',
            content: 'Test content about machine learning',
            embedding: new Array(384).fill(0),
            metadata: {},
          },
        ],
      }),
      searchDocuments: jest.fn().mockResolvedValue([
        {
          chunk: {
            id: 'chunk-1',
            content: 'Test content about machine learning',
            embedding: new Array(384).fill(0),
          },
          document: {
            id: 'doc-1',
            name: 'test.txt',
          },
          score: 0.9,
        },
      ]),
      getDocuments: jest.fn().mockResolvedValue([]),
      getDocument: jest.fn().mockResolvedValue(undefined),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
      updateDocument: jest.fn().mockResolvedValue(undefined),
      getRelevantContext: jest.fn().mockResolvedValue('Relevant context'),
    } as any;

    (DocumentManager as jest.MockedClass<typeof DocumentManager>).mockImplementation(
      () => mockDocumentManager as any
    );

    knowledgeBase = new KnowledgeBase(mockDbManager);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await knowledgeBase.initialize();

      expect(mockDocumentManager.initialize).toHaveBeenCalled();
    });

    it('should emit initialization events', async () => {
      const startSpy = jest.fn();
      const completeSpy = jest.fn();

      knowledgeBase.on('initialization:start', startSpy);
      knowledgeBase.on('initialization:complete', completeSpy);

      await knowledgeBase.initialize();

      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockDocumentManager.initialize.mockRejectedValue(new Error('Init failed'));

      const errorSpy = jest.fn();
      knowledgeBase.on('initialization:error', errorSpy);

      await expect(knowledgeBase.initialize()).rejects.toThrow('Init failed');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await knowledgeBase.initialize();
      await knowledgeBase.initialize();

      expect(mockDocumentManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('document operations', () => {
    beforeEach(async () => {
      await knowledgeBase.initialize();
    });

    it('should add a document', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const documentId = await knowledgeBase.addDocument(testFile);

      expect(documentId).toBe('doc-1');
      expect(mockDocumentManager.addDocument).toHaveBeenCalledWith(testFile);
    });

    it('should emit events when adding document', async () => {
      const addingSpy = jest.fn();
      const addedSpy = jest.fn();

      knowledgeBase.on('document:adding', addingSpy);
      knowledgeBase.on('document:added', addedSpy);

      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      await knowledgeBase.addDocument(testFile);

      expect(addingSpy).toHaveBeenCalledWith({ filePath: testFile });
      expect(addedSpy).toHaveBeenCalledWith({
        documentId: 'doc-1',
        name: 'test.txt',
        chunks: 1,
      });
    });

    it('should remove a document', async () => {
      await knowledgeBase.removeDocument('doc-1');

      expect(mockDocumentManager.deleteDocument).toHaveBeenCalledWith('doc-1');
    });

    it('should update a document', async () => {
      const testFile = path.join(tempDir, 'updated.txt');
      await fs.writeFile(testFile, 'updated content');

      await knowledgeBase.updateDocument('doc-1', testFile);

      expect(mockDocumentManager.updateDocument).toHaveBeenCalledWith('doc-1', testFile);
    });

    it('should clear cache when documents are modified', async () => {
      // Perform a query to populate cache
      await knowledgeBase.query('test query');

      // Add a document (should clear cache)
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      await knowledgeBase.addDocument(testFile);

      // Query again - should not use cache
      mockDocumentManager.searchDocuments.mockClear();
      await knowledgeBase.query('test query');

      expect(mockDocumentManager.searchDocuments).toHaveBeenCalled();
    });
  });

  describe('query operations', () => {
    beforeEach(async () => {
      await knowledgeBase.initialize();
    });

    it('should perform basic query', async () => {
      const result = await knowledgeBase.query('machine learning');

      expect(result).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(mockDocumentManager.searchDocuments).toHaveBeenCalledWith('machine learning', 10);
    });

    it('should respect query options', async () => {
      await knowledgeBase.query('test', {
        maxTokens: 500,
        minScore: 0.7,
      });

      expect(mockDocumentManager.searchDocuments).toHaveBeenCalled();
    });

    it('should filter by file types', async () => {
      mockDocumentManager.searchDocuments.mockResolvedValue([
        {
          chunk: { content: 'test' },
          document: { id: 'doc-1', name: 'test.txt', type: '.txt' },
          score: 0.9,
        },
        {
          chunk: { content: 'test' },
          document: { id: 'doc-2', name: 'test.md', type: '.md' },
          score: 0.8,
        },
      ]);

      const result = await knowledgeBase.query('test', {
        filterFileTypes: ['.txt'],
      });

      expect(result.sources.length).toBe(1);
      expect(result.sources[0].documentId).toBe('doc-1');
    });

    it('should cache query results', async () => {
      const config = {
        enableCaching: true,
        cacheExpirationMs: 5000,
      };
      const cachedKB = new KnowledgeBase(mockDbManager, config);
      await cachedKB.initialize();

      // First query
      await cachedKB.query('test query');
      expect(mockDocumentManager.searchDocuments).toHaveBeenCalledTimes(1);

      // Second query (should use cache)
      const result = await cachedKB.query('test query');
      expect(result.metadata.cached).toBe(true);
      expect(mockDocumentManager.searchDocuments).toHaveBeenCalledTimes(1);
    });

    it('should handle query with conversation context', async () => {
      const conversationHistory = [
        { role: 'user', content: 'Tell me about AI' },
        { role: 'assistant', content: 'AI is fascinating' },
      ];

      await knowledgeBase.queryWithContext('neural networks', conversationHistory);

      expect(mockDocumentManager.searchDocuments).toHaveBeenCalled();
      // Query should be enhanced with context
      const calledQuery = mockDocumentManager.searchDocuments.mock.calls[0][0];
      expect(calledQuery).toContain('neural networks');
    });

    it('should perform hybrid search', async () => {
      const result = await knowledgeBase.hybridSearch('machine learning', ['neural', 'deep']);

      expect(result).toBeDefined();
      expect(mockDocumentManager.searchDocuments).toHaveBeenCalled();
    });
  });

  describe('statistics and export', () => {
    beforeEach(async () => {
      await knowledgeBase.initialize();
    });

    it('should get statistics', async () => {
      mockDocumentManager.getDocuments.mockResolvedValue([
        {
          id: 'doc-1',
          name: 'test.txt',
          type: '.txt',
          chunks: [{ content: 'test' }],
          metadata: { wordCount: 100, language: 'english' },
        },
      ]);

      const stats = await knowledgeBase.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalDocuments).toBe(1);
      expect(stats.languages).toContain('english');
      expect(stats.fileTypes).toContain('.txt');
    });

    it('should export knowledge base as JSON', async () => {
      mockDocumentManager.getDocuments.mockResolvedValue([
        { id: 'doc-1', name: 'test.txt' },
      ]);

      const exported = await knowledgeBase.exportKnowledge('json');

      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should export knowledge base as markdown', async () => {
      mockDocumentManager.getDocuments.mockResolvedValue([
        {
          id: 'doc-1',
          name: 'test.txt',
          type: '.txt',
          size: 1000,
          chunks: [{ content: 'Test content' }],
          metadata: { keywords: ['test'], summary: 'Test summary' },
        },
      ]);

      const exported = await knowledgeBase.exportKnowledge('markdown');

      expect(exported).toContain('# Knowledge Base Export');
      expect(exported).toContain('test.txt');
      expect(exported).toContain('Test summary');
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedKB = new KnowledgeBase(mockDbManager);

      await expect(uninitializedKB.query('test')).rejects.toThrow('must be initialized');
    });

    it('should handle search errors gracefully', async () => {
      await knowledgeBase.initialize();
      mockDocumentManager.searchDocuments.mockRejectedValue(new Error('Search failed'));

      const errorSpy = jest.fn();
      knowledgeBase.on('query:error', errorSpy);

      await expect(knowledgeBase.query('test')).rejects.toThrow('Search failed');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle document operation errors', async () => {
      await knowledgeBase.initialize();
      mockDocumentManager.addDocument.mockRejectedValue(new Error('Add failed'));

      const errorSpy = jest.fn();
      knowledgeBase.on('document:error', errorSpy);

      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test');

      await expect(knowledgeBase.addDocument(testFile)).rejects.toThrow('Add failed');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('context building', () => {
    beforeEach(async () => {
      await knowledgeBase.initialize();
    });

    it('should respect token limits when building context', async () => {
      mockDocumentManager.searchDocuments.mockResolvedValue([
        {
          chunk: { content: 'A'.repeat(1000) },
          document: { id: 'doc-1', name: 'doc1.txt' },
          score: 0.9,
        },
        {
          chunk: { content: 'B'.repeat(1000) },
          document: { id: 'doc-2', name: 'doc2.txt' },
          score: 0.8,
        },
      ]);

      const result = await knowledgeBase.query('test', { maxTokens: 100 });

      // Should truncate to fit token limit
      const estimatedTokens = Math.ceil(result.context.length / 4);
      expect(estimatedTokens).toBeLessThanOrEqual(100);
    });

    it('should include source information in context', async () => {
      const result = await knowledgeBase.query('test');

      expect(result.context).toContain('From:');
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0].documentName).toBe('test.txt');
    });
  });
});