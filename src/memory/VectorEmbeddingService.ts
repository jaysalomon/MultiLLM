import { VectorEmbeddings } from './VectorEmbeddings';

/**
 * Backwards-compatible wrapper expected by some tests.
 * Provides the same API surface as VectorEmbeddings but with the
 * name VectorEmbeddingService.
 */
export class VectorEmbeddingService {
  private impl: VectorEmbeddings;

  constructor() {
    this.impl = new VectorEmbeddings();
  }

  async initialize(): Promise<void> {
    return this.impl.initialize();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.impl.generateEmbedding(text);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return this.impl.generateEmbeddings(texts);
  }

  isReady(): boolean {
    return this.impl.isReady();
  }

  getEmbeddingDimension(): number {
    return this.impl.getEmbeddingDimension();
  }
}
