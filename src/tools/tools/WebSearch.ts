import { Tool } from '../../types/providers';
import fetch from 'node-fetch';

export class WebSearch {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SEARCH_API_KEY;
  }

  getToolDefinition(): Tool {
    return {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for information. Returns relevant search results.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
            num_results: {
              type: 'number',
              description: 'Number of results to return (default: 5)',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  async execute(args: { query: string; num_results?: number }): Promise<string> {
    try {
      const numResults = args.num_results || 5;

      // If API key is available, use a real search API
      if (this.apiKey) {
        // Example using Serper API (you can replace with Google Custom Search, Bing, etc.)
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: args.query,
            num: numResults,
          }),
        });

        if (!response.ok) {
          throw new Error(`Search API error: ${response.statusText}`);
        }

        const data = await response.json();
        const results = this.formatSearchResults(data);
        return JSON.stringify({ results });
      } else {
        // Fallback: Return a message indicating API key is needed
        return JSON.stringify({
          error: 'Search API key not configured. Please set SEARCH_API_KEY environment variable.',
          suggestion: 'You can get a free API key from services like Serper.dev, Google Custom Search, or Bing Search API.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({ error: `Web search failed: ${errorMessage}` });
    }
  }

  private formatSearchResults(data: any): any[] {
    const results = [];

    // Format for Serper API response
    if (data.organic) {
      for (const item of data.organic.slice(0, 5)) {
        results.push({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
        });
      }
    }

    // Add knowledge graph if available
    if (data.knowledgeGraph) {
      results.unshift({
        type: 'knowledge_graph',
        title: data.knowledgeGraph.title,
        description: data.knowledgeGraph.description,
        url: data.knowledgeGraph.website,
      });
    }

    return results;
  }
}