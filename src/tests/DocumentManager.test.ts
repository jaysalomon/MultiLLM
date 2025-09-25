import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DocumentManager } from '../services/DocumentManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { VectorEmbeddings } from '../memory/VectorEmbeddings';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

jest.mock('../memory/VectorEmbeddings');
jest.mock('../database/DatabaseManager');

describe('DocumentManager', () => {
  let documentManager: DocumentManager;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockVectorEmbeddings: jest.Mocked<VectorEmbeddings>;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = path.join(os.tmpdir(), `doc-manager-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Set up mocks
    mockDbManager = {
      memory: {
        addFact: jest.fn().mockResolvedValue(undefined),
        getFacts: jest.fn().mockResolvedValue([]),
        deleteFact: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    mockVectorEmbeddings = {
      initialize: jest.fn().mockResolvedValue(undefined),
      generateEmbedding: jest.fn().mockResolvedValue(new Array(384).fill(0)),
      generateEmbeddings: jest.fn().mockImplementation((texts) =>
        Promise.resolve(texts.map(() => new Array(384).fill(0)))
      ),
      calculateSimilarity: jest.fn().mockReturnValue(0.85),
      isReady: jest.fn().mockReturnValue(true),
      getEmbeddingDimension: jest.fn().mockReturnValue(384),
    } as any;

    (VectorEmbeddings as jest.MockedClass<typeof VectorEmbeddings>).mockImplementation(
      () => mockVectorEmbeddings as any
    );

    documentManager = new DocumentManager(mockDbManager);
    await documentManager.initialize();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('addDocument', () => {
    it('should add a document and generate embeddings', async () => {
      // Create a test file
      const testFile = path.join(tempDir, 'test.txt');
      const testContent = 'This is a test document with some content.';
      await fs.writeFile(testFile, testContent);

      // Add document
      const document = await documentManager.addDocument(testFile);

      expect(document).toBeDefined();
      expect(document.name).toBe('test.txt');
      expect(document.chunks.length).toBeGreaterThan(0);
      expect(mockVectorEmbeddings.generateEmbedding).toHaveBeenCalled();
      expect(mockDbManager.memory.addFact).toHaveBeenCalled();
    });

    it('should detect duplicate documents by hash', async () => {
      // Create a test file
      const testFile = path.join(tempDir, 'test.txt');
      const testContent = 'This is a test document.';
      await fs.writeFile(testFile, testContent);

      // Add document twice
      const doc1 = await documentManager.addDocument(testFile);
      const doc2 = await documentManager.addDocument(testFile);

      expect(doc1.id).toBe(doc2.id);
      expect(doc1.hash).toBe(doc2.hash);
    });

    it('should chunk markdown documents by sections', async () => {
      const mdFile = path.join(tempDir, 'test.md');
      const mdContent = `# Section 1
Content for section 1

## Subsection 1.1
Content for subsection

# Section 2
Content for section 2`;
      await fs.writeFile(mdFile, mdContent);

      const document = await documentManager.addDocument(mdFile);

      expect(document.chunks.length).toBeGreaterThanOrEqual(3);
      expect(document.chunks[0].metadata.section).toBeDefined();
    });

    it('should chunk code files by structure', async () => {
      const codeFile = path.join(tempDir, 'test.js');
      const codeContent = `function foo() {
  return 'foo';
}

class Bar {
  constructor() {
    this.value = 'bar';
  }
}

const baz = () => 'baz';`;
      await fs.writeFile(codeFile, codeContent);

      const document = await documentManager.addDocument(codeFile);

      expect(document.chunks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('searchDocuments', () => {
    beforeEach(async () => {
      // Add some test documents
      const testFiles = [
        { name: 'doc1.txt', content: 'Machine learning is a subset of artificial intelligence.' },
        { name: 'doc2.txt', content: 'Deep learning uses neural networks with multiple layers.' },
        { name: 'doc3.txt', content: 'Natural language processing helps computers understand human language.' },
      ];

      for (const file of testFiles) {
        const filePath = path.join(tempDir, file.name);
        await fs.writeFile(filePath, file.content);
        await documentManager.addDocument(filePath);
      }
    });

    it('should find relevant documents', async () => {
      const results = await documentManager.searchDocuments('neural networks', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].document).toBeDefined();
      expect(results[0].highlights).toBeDefined();
    });

    it('should respect topK parameter', async () => {
      const results = await documentManager.searchDocuments('learning', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should generate highlights for search results', async () => {
      const results = await documentManager.searchDocuments('machine learning', 5);

      const highlights = results[0].highlights;
      expect(highlights).toBeDefined();
      expect(highlights?.length).toBeGreaterThan(0);
    });
  });

  describe('getRelevantContext', () => {
    beforeEach(async () => {
      const testFile = path.join(tempDir, 'context.txt');
      const content = 'This is relevant context about testing and quality assurance.';
      await fs.writeFile(testFile, content);
      await documentManager.addDocument(testFile);
    });

    it('should build context from search results', async () => {
      const context = await documentManager.getRelevantContext('testing', 1000);

      expect(context).toContain('Relevant Context from Knowledge Base');
      expect(context).toContain('testing');
    });

    it('should respect token limits', async () => {
      const context = await documentManager.getRelevantContext('testing', 50);
      const estimatedTokens = Math.ceil(context.length / 4);

      expect(estimatedTokens).toBeLessThanOrEqual(50);
    });

    it('should return empty string when no results', async () => {
      const context = await documentManager.getRelevantContext('nonexistent query xyz123', 1000);

      expect(context).toBe('');
    });
  });

  describe('metadata extraction', () => {
    it('should extract keywords from content', async () => {
      const testFile = path.join(tempDir, 'keywords.txt');
      const content = 'Machine learning machine learning algorithms are powerful. Deep learning is amazing. Neural networks are complex.';
      await fs.writeFile(testFile, content);

      const document = await documentManager.addDocument(testFile);

      expect(document.metadata.keywords).toBeDefined();
      expect(document.metadata.keywords?.length).toBeGreaterThan(0);
      expect(document.metadata.keywords).toContain('machine');
      expect(document.metadata.keywords).toContain('learning');
    });

    it('should detect programming language', async () => {
      const jsFile = path.join(tempDir, 'test.js');
      const jsContent = 'const foo = require("bar"); function test() { console.log("test"); }';
      await fs.writeFile(jsFile, jsContent);

      const document = await documentManager.addDocument(jsFile);

      expect(document.metadata.language).toBe('javascript');
    });

    it('should generate document summary', async () => {
      const testFile = path.join(tempDir, 'summary.txt');
      const content = 'This is the first sentence. This is the second sentence. This is the third sentence.';
      await fs.writeFile(testFile, content);

      const document = await documentManager.addDocument(testFile);

      expect(document.metadata.summary).toBeDefined();
      expect(document.metadata.summary?.length).toBeGreaterThan(0);
    });
  });

  describe('document management', () => {
    it('should get all documents', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      await documentManager.addDocument(testFile);

      const documents = await documentManager.getDocuments();

      expect(documents.length).toBeGreaterThan(0);
    });

    it('should get a specific document', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      const addedDoc = await documentManager.addDocument(testFile);

      const document = await documentManager.getDocument(addedDoc.id);

      expect(document).toBeDefined();
      expect(document?.id).toBe(addedDoc.id);
    });

    it('should delete a document', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      const document = await documentManager.addDocument(testFile);

      await documentManager.deleteDocument(document.id);
      const deletedDoc = await documentManager.getDocument(document.id);

      expect(deletedDoc).toBeUndefined();
      expect(mockDbManager.memory.deleteFact).toHaveBeenCalled();
    });

    it('should update a document', async () => {
      const testFile1 = path.join(tempDir, 'test1.txt');
      const testFile2 = path.join(tempDir, 'test2.txt');
      await fs.writeFile(testFile1, 'original content');
      await fs.writeFile(testFile2, 'updated content');

      const document = await documentManager.addDocument(testFile1);
      const updatedDoc = await documentManager.updateDocument(document.id, testFile2);

      expect(updatedDoc.id).not.toBe(document.id);
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');

      await expect(documentManager.addDocument(nonExistentFile)).rejects.toThrow();
    });

    it('should handle empty files', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyFile, '');

      const document = await documentManager.addDocument(emptyFile);

      expect(document).toBeDefined();
      expect(document.chunks.length).toBe(0);
    });

    it('should handle delete of non-existent document', async () => {
      await expect(documentManager.deleteDocument('non-existent-id')).rejects.toThrow('Document not found');
    });
  });
});