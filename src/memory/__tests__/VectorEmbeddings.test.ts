import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VectorEmbeddings } from '../VectorEmbeddings';

describe('VectorEmbeddings', () => {
  let vectorEmbeddings: VectorEmbeddings;

  beforeAll(async () => {
    vectorEmbeddings = new VectorEmbeddings();
    // Initialize with timeout for model download
    await vectorEmbeddings.initialize();
  }, 60000); // 60 second timeout for model download

  afterAll(() => {
    // Cleanup if needed
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(vectorEmbeddings.isReady()).toBe(true);
    });

    it('should have correct embedding dimension', () => {
      expect(vectorEmbeddings.getEmbeddingDimension()).toBe(384);
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for simple text', async () => {
      const text = 'This is a test sentence.';
      const embedding = await vectorEmbeddings.generateEmbedding(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'Machine learning is fascinating.';
      const text2 = 'I love cooking pasta.';
      
      const embedding1 = await vectorEmbeddings.generateEmbedding(text1);
      const embedding2 = await vectorEmbeddings.generateEmbedding(text2);
      
      expect(embedding1).not.toEqual(embedding2);
    });

    it('should generate similar embeddings for similar texts', async () => {
      const text1 = 'Machine learning is interesting.';
      const text2 = 'Machine learning is fascinating.';
      
      const embedding1 = await vectorEmbeddings.generateEmbedding(text1);
      const embedding2 = await vectorEmbeddings.generateEmbedding(text2);
      
      const similarity = vectorEmbeddings.calculateSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.7); // Should be quite similar
    });

    it('should handle empty text gracefully', async () => {
      await expect(vectorEmbeddings.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
    });

    it('should normalize embeddings to unit length', async () => {
      const text = 'Test normalization';
      const embedding = await vectorEmbeddings.generateEmbedding(text);
      
      // Calculate magnitude
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 5); // Should be close to 1.0
    });
  });

  describe('generateEmbeddings (batch)', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First test sentence.',
        'Second test sentence.',
        'Third test sentence.'
      ];
      
      const embeddings = await vectorEmbeddings.generateEmbeddings(texts);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
      expect(embeddings.every(emb => emb.length === 384)).toBe(true);
    });

    it('should handle empty array', async () => {
      const embeddings = await vectorEmbeddings.generateEmbeddings([]);
      expect(embeddings).toEqual([]);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const vector3 = [1, 0, 0];
      
      const similarity1 = vectorEmbeddings.calculateSimilarity(vector1, vector2);
      const similarity2 = vectorEmbeddings.calculateSimilarity(vector1, vector3);
      
      expect(similarity1).toBeCloseTo(0, 5); // Orthogonal vectors
      expect(similarity2).toBeCloseTo(1, 5); // Identical vectors
    });

    it('should handle zero vectors', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 0, 0];
      
      const similarity = vectorEmbeddings.calculateSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });

    it('should throw error for different length vectors', () => {
      const vector1 = [1, 0];
      const vector2 = [1, 0, 0];
      
      expect(() => {
        vectorEmbeddings.calculateSimilarity(vector1, vector2);
      }).toThrow('Vectors must have the same length');
    });
  });

  describe('findSimilar', () => {
    it('should find most similar vectors', () => {
      const queryVector = [1, 0, 0];
      const candidates = [
        { vector: [1, 0, 0], id: 'exact', metadata: { type: 'exact' } },
        { vector: [0.9, 0.1, 0], id: 'close', metadata: { type: 'close' } },
        { vector: [0, 1, 0], id: 'orthogonal', metadata: { type: 'orthogonal' } },
        { vector: [0.5, 0.5, 0], id: 'medium', metadata: { type: 'medium' } }
      ];
      
      const results = vectorEmbeddings.findSimilar(queryVector, candidates, 3, 0.1);
      
      expect(results.length).toBeLessThanOrEqual(3);
      expect(results[0].id).toBe('exact');
      expect(results[0].similarity).toBeCloseTo(1, 5);
      
      // Results should be sorted by similarity (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity);
      }
    });

    it('should filter by minimum similarity', () => {
      const queryVector = [1, 0, 0];
      const candidates = [
        { vector: [1, 0, 0], id: 'exact', metadata: {} },
        { vector: [0, 1, 0], id: 'orthogonal', metadata: {} }
      ];
      
      const results = vectorEmbeddings.findSimilar(queryVector, candidates, 10, 0.5);
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('exact');
    });

    it('should respect topK limit', () => {
      const queryVector = [1, 0, 0];
      const candidates = Array.from({ length: 10 }, (_, i) => ({
        vector: [0.9 - i * 0.1, 0.1 + i * 0.1, 0],
        id: `candidate_${i}`,
        metadata: {}
      }));
      
      const results = vectorEmbeddings.findSimilar(queryVector, candidates, 3, 0);
      
      expect(results.length).toBe(3);
    });
  });
});