import { Tool } from '../../types/providers';
import { KnowledgeBase } from '../../services/KnowledgeBase';

export class KnowledgeSearch {
  private knowledgeBase: KnowledgeBase | null = null;

  setKnowledgeBase(kb: KnowledgeBase): void {
    this.knowledgeBase = kb;
  }

  getToolDefinition(): Tool {
    return {
      type: 'function',
      function: {
        name: 'knowledge_search',
        description: 'Search the knowledge base for relevant information from uploaded documents',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to find relevant information',
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5)',
            },
            file_types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by file types (e.g., [".pdf", ".md"])',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  async execute(args: {
    query: string;
    max_results?: number;
    file_types?: string[];
  }): Promise<string> {
    try {
      if (!this.knowledgeBase) {
        return JSON.stringify({
          error: 'Knowledge base not initialized',
          message: 'Please add documents to the knowledge base first',
        });
      }

      const result = await this.knowledgeBase.query(args.query, {
        maxTokens: 2000,
        filterFileTypes: args.file_types,
      });

      // Format the results
      const formattedResults = {
        query: args.query,
        found: result.sources.length > 0,
        num_results: result.sources.length,
        sources: result.sources.map(s => ({
          document: s.documentName,
          relevance: Math.round(s.score * 100) / 100,
        })),
        context: result.context.substring(0, 500) + (result.context.length > 500 ? '...' : ''),
        metadata: {
          tokens_used: result.metadata.tokensUsed,
          processing_time_ms: result.metadata.processingTime,
        },
      };

      return JSON.stringify(formattedResults);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({
        error: `Knowledge search failed: ${errorMessage}`,
      });
    }
  }
}