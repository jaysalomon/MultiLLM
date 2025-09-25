/**
 * RAG Integration for LLM Orchestrator
 * Provides context injection from knowledge base into LLM prompts
 */

import { KnowledgeBase } from '../services/KnowledgeBase';
import { ChatMessage } from '../types/chat';

export interface RAGConfig {
  enabled: boolean;
  autoInject: boolean;
  maxContextTokens: number;
  minRelevanceScore: number;
  contextPosition: 'system' | 'user' | 'both';
}

export class RAGIntegration {
  private knowledgeBase: KnowledgeBase | null = null;
  private config: RAGConfig;

  constructor(config?: Partial<RAGConfig>) {
    this.config = {
      enabled: true,
      autoInject: true,
      maxContextTokens: 2000,
      minRelevanceScore: 0.5,
      contextPosition: 'system',
      ...config,
    };
  }

  setKnowledgeBase(kb: KnowledgeBase): void {
    this.knowledgeBase = kb;
  }

  async enhanceMessagesWithContext(
    messages: ChatMessage[],
    systemPrompt?: string
  ): Promise<{ messages: ChatMessage[]; enhancedSystemPrompt?: string }> {
    if (!this.config.enabled || !this.knowledgeBase) {
      return { messages, enhancedSystemPrompt: systemPrompt };
    }

    // Extract query from recent messages
    const recentUserMessages = messages
      .filter(m => m.sender === 'user')
      .slice(-3)
      .map(m => m.content)
      .join(' ');

    if (!recentUserMessages) {
      return { messages, enhancedSystemPrompt: systemPrompt };
    }

    try {
      // Query knowledge base for relevant context
      const result = await this.knowledgeBase.queryWithContext(
        recentUserMessages,
        messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }))
      );

      if (!result.context || result.sources.length === 0) {
        return { messages, enhancedSystemPrompt: systemPrompt };
      }

      // Inject context based on configuration
      if (this.config.contextPosition === 'system') {
        const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
          systemPrompt,
          result.context,
          result.sources
        );
        return { messages, enhancedSystemPrompt };
      } else if (this.config.contextPosition === 'user') {
        const enhancedMessages = this.injectContextIntoMessages(
          messages,
          result.context,
          result.sources
        );
        return { messages: enhancedMessages, enhancedSystemPrompt: systemPrompt };
      } else {
        // Both: Add to system prompt and as a user message
        const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
          systemPrompt,
          result.context,
          result.sources
        );
        const enhancedMessages = this.injectContextIntoMessages(
          messages,
          result.context,
          result.sources
        );
        return { messages: enhancedMessages, enhancedSystemPrompt };
      }
    } catch (error) {
      console.error('Failed to enhance messages with RAG context:', error);
      return { messages, enhancedSystemPrompt: systemPrompt };
    }
  }

  private buildEnhancedSystemPrompt(
    originalPrompt: string | undefined,
    context: string,
    sources: any[]
  ): string {
    const sourceList = sources.map(s => s.documentName).join(', ');

    let enhancedPrompt = originalPrompt || '';

    enhancedPrompt += `\n\n## Knowledge Base Context

The following relevant information has been retrieved from the knowledge base:

${context}

Sources: ${sourceList}

Please consider this context when formulating your response, but prioritize accuracy and relevance. If the context doesn't seem relevant to the user's question, you may disregard it.`;

    return enhancedPrompt;
  }

  private injectContextIntoMessages(
    messages: ChatMessage[],
    context: string,
    sources: any[]
  ): ChatMessage[] {
    const sourceList = sources.map(s => s.documentName).join(', ');

    // Find the last user message
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) {
      return messages;
    }

    // Create a context message
    const contextMessage: ChatMessage = {
      id: `context_${Date.now()}`,
      content: `[Knowledge Base Context from: ${sourceList}]\n${context}`,
      sender: 'system',
      timestamp: new Date(),
      conversationId: messages[0]?.conversationId || '',
    };

    // Insert context message before the last user message
    const enhancedMessages = [...messages];
    enhancedMessages.splice(lastUserIndex, 0, contextMessage);

    return enhancedMessages;
  }

  async shouldInjectContext(messages: ChatMessage[]): Promise<boolean> {
    if (!this.config.autoInject) {
      return false;
    }

    // Check if the last user message seems to be asking a question
    const lastUserMessage = messages
      .filter(m => m.sender === 'user')
      .pop();

    if (!lastUserMessage) {
      return false;
    }

    const content = lastUserMessage.content.toLowerCase();

    // Simple heuristics to determine if context might be helpful
    const questionIndicators = [
      '?',
      'what',
      'how',
      'why',
      'when',
      'where',
      'who',
      'explain',
      'describe',
      'tell me',
      'show me',
      'find',
      'search',
      'help',
    ];

    return questionIndicators.some(indicator => content.includes(indicator));
  }

  getConfig(): RAGConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isEnabled(): boolean {
    return this.config.enabled && this.knowledgeBase !== null;
  }

  async getStats() {
    if (!this.knowledgeBase) {
      return null;
    }
    return this.knowledgeBase.getStats();
  }
}