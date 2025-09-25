import { DatabaseManager } from '../database/DatabaseManager';
import { FileContextProvider } from '../main/services/context/providers/FileContextProvider';
import { VectorEmbeddings } from '../memory/VectorEmbeddings';
import { MemoryFact } from '../types/memory';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export interface Document {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  hash: string;
  chunks: DocumentChunk[];
  metadata: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
  position: number;
}

export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  pageNumber?: number;
  section?: string;
  headings?: string[];
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  wordCount: number;
  pageCount?: number;
  language?: string;
  summary?: string;
  keywords?: string[];
  fileType: string;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  score: number;
  highlights?: string[];
}

export class DocumentManager {
  private dbManager: DatabaseManager;
  private fileProvider: FileContextProvider;
  private vectorEmbeddings: VectorEmbeddings;
  private documents: Map<string, Document> = new Map();

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.fileProvider = new FileContextProvider();
    this.vectorEmbeddings = new VectorEmbeddings();
  }

  async initialize(): Promise<void> {
    await this.vectorEmbeddings.initialize();
    await this.loadDocuments();
  }

  async addDocument(filePath: string): Promise<Document> {
    // Check if document already exists by hash
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingDoc = Array.from(this.documents.values()).find(d => d.hash === hash);
    if (existingDoc) {
      console.log(`Document already exists: ${existingDoc.name}`);
      return existingDoc;
    }

    const stats = await fs.stat(filePath);
    const { content, metadata } = await this.fileProvider.loadFile(filePath);

    const document: Document = {
      id: uuidv4(),
      name: path.basename(filePath),
      path: filePath,
      type: path.extname(filePath).toLowerCase(),
      size: stats.size,
      hash,
      chunks: [],
      metadata: await this.extractMetadata(content, filePath, metadata),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Smart chunking based on document structure
    const chunks = await this.smartChunk(content, document.type);

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.vectorEmbeddings.generateEmbedding(chunk.content);

      const documentChunk: DocumentChunk = {
        id: uuidv4(),
        documentId: document.id,
        content: chunk.content,
        embedding,
        metadata: chunk.metadata,
        position: i,
      };

      document.chunks.push(documentChunk);

      // Store in memory system for backwards compatibility
      const fact: Omit<MemoryFact, 'id'> = {
        content: chunk.content,
        source: 'document',
        timestamp: new Date(),
        relevanceScore: 0.8,
        tags: [
          `doc:${document.id}`,
          `file:${document.name}`,
          `type:${document.type}`,
          ...(chunk.metadata.section ? [`section:${chunk.metadata.section}`] : []),
        ],
        embedding,
        verified: true,
        references: [filePath],
      };

      await this.dbManager.memory.addFact('global', fact);
    }

    // Store document
    this.documents.set(document.id, document);
    await this.saveDocuments();

    return document;
  }

  async searchDocuments(query: string, topK: number = 10): Promise<SearchResult[]> {
    const queryEmbedding = await this.vectorEmbeddings.generateEmbedding(query);
    const results: SearchResult[] = [];

    for (const document of this.documents.values()) {
      for (const chunk of document.chunks) {
        const score = this.vectorEmbeddings.calculateSimilarity(
          queryEmbedding,
          chunk.embedding
        );

        results.push({
          chunk,
          document,
          score,
          highlights: this.generateHighlights(chunk.content, query),
        });
      }
    }

    // Sort by score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async getRelevantContext(query: string, maxTokens: number = 2000): Promise<string> {
    const searchResults = await this.searchDocuments(query, 5);

    if (searchResults.length === 0) {
      return '';
    }

    let context = '## Relevant Context from Knowledge Base\n\n';
    let tokenCount = 0;
    const tokenLimit = maxTokens;

    for (const result of searchResults) {
      const chunkInfo = `### From: ${result.document.name}\n${result.chunk.content}\n\n`;
      const chunkTokens = this.estimateTokens(chunkInfo);

      if (tokenCount + chunkTokens > tokenLimit) {
        break;
      }

      context += chunkInfo;
      tokenCount += chunkTokens;
    }

    return context;
  }

  private async smartChunk(
    content: string,
    fileType: string
  ): Promise<Array<{ content: string; metadata: ChunkMetadata }>> {
    const chunks: Array<{ content: string; metadata: ChunkMetadata }> = [];

    if (fileType === '.md' || fileType === '.markdown') {
      // Chunk by markdown sections
      chunks.push(...this.chunkByMarkdownSections(content));
    } else if (fileType === '.pdf') {
      // Chunk by pages (simplified for now)
      chunks.push(...this.chunkByParagraphs(content, 1000));
    } else if (['.ts', '.js', '.tsx', '.jsx', '.py', '.java'].includes(fileType)) {
      // Chunk code by functions/classes
      chunks.push(...this.chunkCodeByStructure(content, fileType));
    } else {
      // Default: chunk by paragraphs with overlap
      chunks.push(...this.chunkByParagraphs(content, 1000));
    }

    return chunks;
  }

  private chunkByMarkdownSections(content: string): Array<{ content: string; metadata: ChunkMetadata }> {
    const chunks: Array<{ content: string; metadata: ChunkMetadata }> = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let currentHeadings: string[] = [];
    let startChar = 0;
    let currentChar = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

      if (headingMatch) {
        // Save previous chunk if exists
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              startChar,
              endChar: currentChar,
              headings: [...currentHeadings],
              section: currentHeadings[currentHeadings.length - 1],
            },
          });
        }

        // Update heading hierarchy
        const level = headingMatch[1].length;
        const heading = headingMatch[2];
        currentHeadings = currentHeadings.slice(0, level - 1);
        currentHeadings.push(heading);

        // Start new chunk
        currentChunk = line + '\n';
        startChar = currentChar;
      } else {
        currentChunk += line + '\n';
      }

      currentChar += line.length + 1;
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          startChar,
          endChar: currentChar,
          headings: [...currentHeadings],
          section: currentHeadings[currentHeadings.length - 1],
        },
      });
    }

    return chunks;
  }

  private chunkByParagraphs(
    content: string,
    maxChunkSize: number
  ): Array<{ content: string; metadata: ChunkMetadata }> {
    const chunks: Array<{ content: string; metadata: ChunkMetadata }> = [];
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let startChar = 0;
    let currentChar = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            startChar,
            endChar: currentChar,
          },
        });
        currentChunk = paragraph;
        startChar = currentChar;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
      currentChar += paragraph.length + 2;
    }

    if (currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          startChar,
          endChar: currentChar,
        },
      });
    }

    return chunks;
  }

  private chunkCodeByStructure(
    content: string,
    fileType: string
  ): Array<{ content: string; metadata: ChunkMetadata }> {
    const chunks: Array<{ content: string; metadata: ChunkMetadata }> = [];
    const lines = content.split('\n');

    // Simple regex patterns for common code structures
    const patterns = {
      function: /^(export\s+)?(async\s+)?function\s+\w+/,
      class: /^(export\s+)?class\s+\w+/,
      method: /^\s*(public|private|protected|static|async)?\s*\w+\s*\([^)]*\)\s*{/,
      arrow: /^(export\s+)?const\s+\w+\s*=\s*(\([^)]*\)|[^=]+)\s*=>/,
    };

    let currentChunk = '';
    let startChar = 0;
    let currentChar = 0;
    let bracketCount = 0;
    let inStructure = false;

    for (const line of lines) {
      const isStructureStart = Object.values(patterns).some(pattern => pattern.test(line));

      if (isStructureStart && !inStructure) {
        // Save previous chunk
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              startChar,
              endChar: currentChar,
            },
          });
        }

        // Start new chunk
        currentChunk = line + '\n';
        startChar = currentChar;
        inStructure = true;
        bracketCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      } else {
        currentChunk += line + '\n';
        if (inStructure) {
          bracketCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          if (bracketCount === 0) {
            inStructure = false;
          }
        }
      }

      currentChar += line.length + 1;
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          startChar,
          endChar: currentChar,
        },
      });
    }

    return chunks;
  }

  private async extractMetadata(
    content: string,
    filePath: string,
    fileMetadata: any
  ): Promise<DocumentMetadata> {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const fileType = path.extname(filePath).toLowerCase();

    // Extract keywords using simple TF-IDF
    const keywords = this.extractKeywords(content, 10);

    return {
      title: fileMetadata?.fileName || path.basename(filePath, path.extname(filePath)),
      wordCount: words.length,
      language: this.detectLanguage(content),
      keywords,
      fileType,
      summary: await this.generateSummary(content),
    };
  }

  private extractKeywords(content: string, topK: number = 10): string[] {
    // Simple keyword extraction based on word frequency
    const words = content.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3 && !this.isStopWord(w));

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([word]) => word);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'will',
      'what', 'when', 'where', 'which', 'while', 'their', 'there', 'these',
      'those', 'then', 'than', 'been', 'being', 'about', 'after', 'before',
      'between', 'through', 'during', 'under', 'over', 'into', 'onto',
    ]);
    return stopWords.has(word);
  }

  private detectLanguage(content: string): string {
    // Simple language detection based on common keywords
    const codePatterns = {
      javascript: /\b(const|let|var|function|console|require|import|export)\b/,
      typescript: /\b(interface|type|enum|namespace|declare|implements)\b/,
      python: /\b(def|import|from|class|self|print|if __name__)\b/,
      java: /\b(public|private|static|void|class|package|import)\b/,
    };

    for (const [lang, pattern] of Object.entries(codePatterns)) {
      if (pattern.test(content)) {
        return lang;
      }
    }

    return 'english'; // Default to English for non-code content
  }

  private async generateSummary(content: string, maxLength: number = 200): Promise<string> {
    // Simple extractive summary - take first few sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    let summary = '';

    for (const sentence of sentences) {
      if (summary.length + sentence.length > maxLength) {
        break;
      }
      summary += sentence;
    }

    return summary.trim() || content.substring(0, maxLength) + '...';
  }

  private generateHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      if (queryWords.some(word => sentenceLower.includes(word))) {
        highlights.push(sentence.trim());
        if (highlights.length >= 3) break;
      }
    }

    return highlights;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getDocument(documentId: string): Promise<Document | undefined> {
    return this.documents.get(documentId);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Remove from memory system
    const facts = await this.dbManager.memory.getFacts('global');
    for (const fact of facts) {
      if (fact.tags.includes(`doc:${documentId}`)) {
        await this.dbManager.memory.deleteFact(fact.id);
      }
    }

    // Remove from local storage
    this.documents.delete(documentId);
    await this.saveDocuments();
  }

  async updateDocument(documentId: string, filePath: string): Promise<Document> {
    await this.deleteDocument(documentId);
    return this.addDocument(filePath);
  }

  private async saveDocuments(): Promise<void> {
    // Save to a local JSON file for persistence
    const documentsData = Array.from(this.documents.values()).map(doc => ({
      ...doc,
      chunks: doc.chunks.map(chunk => ({
        ...chunk,
        embedding: [], // Don't save embeddings to reduce file size
      })),
    }));

    const configPath = path.join(process.cwd(), 'documents.json');
    await fs.writeFile(configPath, JSON.stringify(documentsData, null, 2));
  }

  private async loadDocuments(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'documents.json');
      const data = await fs.readFile(configPath, 'utf-8');
      const documentsData = JSON.parse(data);

      for (const docData of documentsData) {
        // Regenerate embeddings if needed
        for (const chunk of docData.chunks) {
          if (!chunk.embedding || chunk.embedding.length === 0) {
            chunk.embedding = await this.vectorEmbeddings.generateEmbedding(chunk.content);
          }
        }

        this.documents.set(docData.id, {
          ...docData,
          createdAt: new Date(docData.createdAt),
          updatedAt: new Date(docData.updatedAt),
        });
      }
    } catch (error) {
      console.log('No existing documents found or error loading:', error);
    }
  }

  async refreshEmbeddings(): Promise<void> {
    for (const document of this.documents.values()) {
      for (const chunk of document.chunks) {
        chunk.embedding = await this.vectorEmbeddings.generateEmbedding(chunk.content);
      }
    }
    await this.saveDocuments();
  }
}