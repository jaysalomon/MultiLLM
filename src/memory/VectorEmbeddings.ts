import { pipeline, Pipeline } from '@xenova/transformers';

/**
 * Local vector embedding service using transformers.js
 * Requirements: 8.1, 8.2, 8.5
 */
export class VectorEmbeddings {
  private embeddingPipeline: Pipeline | null = null;
  private isInitialized = false;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2'; // Lightweight embedding model

  /**
   * Initialize the embedding pipeline
   * Requirements: 8.1, 8.2
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('Initializing vector embedding pipeline...');
      this.embeddingPipeline = await pipeline('feature-extraction', this.modelName);
      this.isInitialized = true;
      console.log('Vector embedding pipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize embedding pipeline:', error);
      throw new Error(`Failed to initialize vector embeddings: ${error}`);
    }
  }

  /**
   * Generate vector embedding for text
   * Requirements: 8.1, 8.2
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized || !this.embeddingPipeline) {
      await this.initialize();
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      // Clean and normalize text
      const cleanText = this.preprocessText(text);
      
      // Generate embedding
      const result = await this.embeddingPipeline!(cleanText);
      
      // Extract the embedding vector from the result
      let embedding: number[];
      if (result && result.data) {
        embedding = Array.from(result.data);
      } else if (Array.isArray(result)) {
        embedding = result;
      } else if (result && typeof result === 'object' && 'tolist' in result) {
        // Handle tensor-like objects
        embedding = result.tolist ? result.tolist() : Array.from(result as any);
      } else {
        throw new Error('Unexpected embedding result format');
      }

      // Normalize the embedding vector
      return this.normalizeVector(embedding);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Requirements: 8.1, 8.2
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];
    
    // Process in batches to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Requirements: 8.2, 8.5
   */
  calculateSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Find most similar vectors to a query vector
   * Requirements: 8.2, 8.5
   */
  findSimilar(
    queryVector: number[], 
    candidateVectors: Array<{ vector: number[]; id: string; metadata?: any }>,
    topK: number = 5,
    minSimilarity: number = 0.1
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    const similarities = candidateVectors
      .map(candidate => ({
        id: candidate.id,
        similarity: this.calculateSimilarity(queryVector, candidate.vector),
        metadata: candidate.metadata
      }))
      .filter(result => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return similarities;
  }

  /**
   * Preprocess text for embedding generation
   * Requirements: 8.1, 8.2
   */
  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .toLowerCase();
  }

  /**
   * Normalize vector to unit length
   * Requirements: 8.2
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return vector;
    }
    return vector.map(val => val / magnitude);
  }

  /**
   * Check if the embedding service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.embeddingPipeline !== null;
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    // all-MiniLM-L6-v2 produces 384-dimensional embeddings
    return 384;
  }
}