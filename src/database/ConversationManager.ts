import { ConversationRepository } from './ConversationRepository';
import { Database } from './Database';
import type { 
  ChatMessage, 
  ConversationState, 
  ModelParticipant 
} from '../types/chat';
import type { SharedMemoryContext } from '../types/memory';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

/**
 * High-level conversation management with export/import capabilities
 * Requirements: 9.1, 9.2, 9.3, 9.4, 6.3
 */
export class ConversationManager {
  private conversationRepo: ConversationRepository;

  constructor(private database: Database) {
    this.conversationRepo = new ConversationRepository(database);
  }

  /**
   * Create a new conversation
   * Requirements: 6.3, 9.1
   */
  async createConversation(title?: string): Promise<string> {
    return await this.conversationRepo.createConversation(title);
  }

  /**
   * Load a conversation by ID
   * Requirements: 6.3, 9.1
   */
  async loadConversation(conversationId: string): Promise<ConversationState | null> {
    return await this.conversationRepo.getConversation(conversationId);
  }

  /**
   * Save conversation updates
   * Requirements: 6.3, 9.1
   */
  async saveConversation(conversation: ConversationState): Promise<void> {
    await this.conversationRepo.updateConversation(conversation.id, {
      title: this.generateConversationTitle(conversation),
      metadata: {
        participantCount: conversation.participants.length,
        messageCount: conversation.messages.length,
        lastActivity: conversation.updatedAt
      }
    });
  }

  /**
   * Get all conversations with metadata
   * Requirements: 6.3, 9.3
   */
  async getAllConversations(): Promise<Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    participantCount: number;
  }>> {
    return await this.conversationRepo.getAllConversations();
  }

  /**
   * Search conversations by title or content
   * Requirements: 9.3
   */
  async searchConversations(query: string, options?: {
    limit?: number;
    includeContent?: boolean;
  }): Promise<Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    matchType: 'title' | 'message';
    snippet?: string;
  }>> {
    return await this.conversationRepo.searchConversations(
      query, 
      options?.limit || 50
    );
  }

  /**
   * Filter conversations by criteria
   * Requirements: 9.3
   */
  async filterConversations(filters: {
    dateRange?: { start: Date; end: Date };
    participantCount?: { min?: number; max?: number };
    messageCount?: { min?: number; max?: number };
    hasParticipant?: string; // model ID
  }): Promise<Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    participantCount: number;
  }>> {
    // This would require a more complex query - for now, get all and filter in memory
    const allConversations = await this.getAllConversations();
    
    return allConversations.filter(conv => {
      if (filters.dateRange) {
        if (conv.createdAt < filters.dateRange.start || conv.createdAt > filters.dateRange.end) {
          return false;
        }
      }
      
      if (filters.participantCount) {
        if (filters.participantCount.min && conv.participantCount < filters.participantCount.min) {
          return false;
        }
        if (filters.participantCount.max && conv.participantCount > filters.participantCount.max) {
          return false;
        }
      }
      
      if (filters.messageCount) {
        if (filters.messageCount.min && conv.messageCount < filters.messageCount.min) {
          return false;
        }
        if (filters.messageCount.max && conv.messageCount > filters.messageCount.max) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Delete a conversation and all related data
   * Requirements: 9.4, 6.3
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.conversationRepo.deleteConversation(conversationId);
  }

  /**
   * Export conversation in JSON format
   * Requirements: 9.2
   */
  async exportConversationJSON(conversationId: string): Promise<string> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      conversation: {
        id: conversation.id,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        participants: conversation.participants.map(p => ({
          id: p.id,
          provider: {
            type: p.provider.type,
            name: p.provider.name,
            config: p.provider.config
          },
          modelName: p.modelName,
          displayName: p.displayName,
          color: p.color,
          avatar: p.avatar,
          isActive: p.isActive,
          addedAt: p.addedAt.toISOString()
        })),
        messages: conversation.messages.map(m => ({
          id: m.id,
          content: m.content,
          sender: m.sender,
          timestamp: m.timestamp.toISOString(),
          replyTo: m.replyTo,
          metadata: m.metadata
        })),
        sharedMemory: {
          conversationId: conversation.sharedMemory.conversationId,
          facts: conversation.sharedMemory.facts.map(f => ({
            ...f,
            timestamp: f.timestamp.toISOString()
          })),
          summaries: conversation.sharedMemory.summaries.map(s => ({
            ...s,
            timeRange: {
              start: s.timeRange.start.toISOString(),
              end: s.timeRange.end.toISOString()
            },
            createdAt: s.createdAt.toISOString()
          })),
          relationships: conversation.sharedMemory.relationships.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString()
          })),
          lastUpdated: conversation.sharedMemory.lastUpdated.toISOString(),
          version: conversation.sharedMemory.version
        }
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export conversation in Markdown format
   * Requirements: 9.2
   */
  async exportConversationMarkdown(conversationId: string): Promise<string> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const title = this.generateConversationTitle(conversation);
    let markdown = `# ${title}\n\n`;
    
    // Add metadata
    markdown += `**Created:** ${conversation.createdAt.toLocaleString()}\n`;
    markdown += `**Last Updated:** ${conversation.updatedAt.toLocaleString()}\n`;
    markdown += `**Participants:** ${conversation.participants.length}\n`;
    markdown += `**Messages:** ${conversation.messages.length}\n\n`;

    // Add participants
    if (conversation.participants.length > 0) {
      markdown += `## Participants\n\n`;
      conversation.participants.forEach(p => {
        markdown += `- **${p.displayName}** (${p.modelName}) - ${p.provider.type}\n`;
      });
      markdown += '\n';
    }

    // Add messages
    markdown += `## Conversation\n\n`;
    conversation.messages.forEach(message => {
      const senderName = message.sender === 'user' ? 'User' : 
        conversation.participants.find(p => p.id === message.sender)?.displayName || message.sender;
      
      markdown += `### ${senderName}\n`;
      markdown += `*${message.timestamp.toLocaleString()}*\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (message.replyTo) {
        const replyToMessage = conversation.messages.find(m => m.id === message.replyTo);
        if (replyToMessage) {
          const replyToSender = replyToMessage.sender === 'user' ? 'User' : 
            conversation.participants.find(p => p.id === replyToMessage.sender)?.displayName || replyToMessage.sender;
          markdown += `> *In reply to ${replyToSender}*\n\n`;
        }
      }
      
      markdown += '---\n\n';
    });

    // Add shared memory summary if available
    if (conversation.sharedMemory.facts.length > 0 || conversation.sharedMemory.summaries.length > 0) {
      markdown += `## Shared Memory\n\n`;
      
      if (conversation.sharedMemory.facts.length > 0) {
        markdown += `### Key Facts (${conversation.sharedMemory.facts.length})\n\n`;
        conversation.sharedMemory.facts
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 10) // Top 10 most relevant facts
          .forEach(fact => {
            markdown += `- ${fact.content} *(${fact.source})*\n`;
          });
        markdown += '\n';
      }
      
      if (conversation.sharedMemory.summaries.length > 0) {
        markdown += `### Summaries\n\n`;
        conversation.sharedMemory.summaries.forEach(summary => {
          markdown += `#### ${summary.timeRange.start.toLocaleDateString()} - ${summary.timeRange.end.toLocaleDateString()}\n\n`;
          markdown += `${summary.summary}\n\n`;
          if (summary.keyPoints.length > 0) {
            markdown += `**Key Points:**\n`;
            summary.keyPoints.forEach(point => {
              markdown += `- ${point}\n`;
            });
            markdown += '\n';
          }
        });
      }
    }

    return markdown;
  }

  /**
   * Export conversation in plain text format
   * Requirements: 9.2
   */
  async exportConversationText(conversationId: string): Promise<string> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const title = this.generateConversationTitle(conversation);
    let text = `${title}\n${'='.repeat(title.length)}\n\n`;
    
    // Add metadata
    text += `Created: ${conversation.createdAt.toLocaleString()}\n`;
    text += `Last Updated: ${conversation.updatedAt.toLocaleString()}\n`;
    text += `Participants: ${conversation.participants.length}\n`;
    text += `Messages: ${conversation.messages.length}\n\n`;

    // Add participants
    if (conversation.participants.length > 0) {
      text += `PARTICIPANTS:\n`;
      conversation.participants.forEach(p => {
        text += `- ${p.displayName} (${p.modelName}) - ${p.provider.type}\n`;
      });
      text += '\n';
    }

    // Add messages
    text += `CONVERSATION:\n${'-'.repeat(50)}\n\n`;
    conversation.messages.forEach(message => {
      const senderName = message.sender === 'user' ? 'User' : 
        conversation.participants.find(p => p.id === message.sender)?.displayName || message.sender;
      
      text += `[${message.timestamp.toLocaleString()}] ${senderName}:\n`;
      text += `${message.content}\n\n`;
    });

    return text;
  }

  /**
   * Save exported conversation to file
   * Requirements: 9.2
   */
  async saveConversationToFile(
    conversationId: string, 
    format: 'json' | 'markdown' | 'text',
    filePath: string
  ): Promise<void> {
    let content: string;
    
    switch (format) {
      case 'json':
        content = await this.exportConversationJSON(conversationId);
        break;
      case 'markdown':
        content = await this.exportConversationMarkdown(conversationId);
        break;
      case 'text':
        content = await this.exportConversationText(conversationId);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Import conversation from JSON file
   * Requirements: 9.4
   */
  async importConversationFromJSON(jsonContent: string): Promise<string> {
    try {
      const importData = JSON.parse(jsonContent);
      
      if (!importData.conversation) {
        throw new Error('Invalid conversation export format');
      }

      const conv = importData.conversation;
      
      // Create new conversation
      const newConversationId = uuidv4();
      await this.conversationRepo.createConversation(
        `${conv.title || 'Imported Conversation'} (Imported)`
      );

      // Import participants
      const participantIdMap = new Map<string, string>();
      for (const participant of conv.participants) {
        const newParticipantId = uuidv4();
        participantIdMap.set(participant.id, newParticipantId);
        
        const modelParticipant: ModelParticipant = {
          id: newParticipantId,
          provider: {
            id: newParticipantId,
            name: participant.provider.name,
            type: participant.provider.type,
            config: participant.provider.config,
            isActive: participant.isActive
          },
          modelName: participant.modelName,
          displayName: participant.displayName,
          color: participant.color,
          avatar: participant.avatar,
          isActive: participant.isActive,
          addedAt: new Date(participant.addedAt)
        };
        
        await this.conversationRepo.addParticipant(newConversationId, modelParticipant);
      }

      // Import messages
      for (const message of conv.messages) {
        const newMessageId = uuidv4();
        const sender = message.sender === 'user' ? 'user' : 
          participantIdMap.get(message.sender) || message.sender;
        
        const chatMessage: ChatMessage = {
          id: newMessageId,
          content: message.content,
          sender,
          timestamp: new Date(message.timestamp),
          replyTo: message.replyTo,
          metadata: {
            ...message.metadata,
            conversationId: newConversationId
          }
        };
        
        await this.conversationRepo.addMessage(chatMessage);
      }

      return newConversationId;
    } catch (error) {
      throw new Error(`Failed to import conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import conversation from file
   * Requirements: 9.4
   */
  async importConversationFromFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.json') {
        return await this.importConversationFromJSON(content);
      } else {
        throw new Error(`Unsupported import format: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to import conversation from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversation statistics
   * Requirements: 9.3
   */
  async getConversationStats(conversationId: string): Promise<{
    messageCount: number;
    participantCount: number;
    firstMessageAt?: Date;
    lastMessageAt?: Date;
    totalTokens?: number;
    averageResponseTime?: number;
  }> {
    const stats = await this.conversationRepo.getConversationStats(conversationId);
    
    // Calculate additional stats from messages
    const messages = await this.conversationRepo.getMessages(conversationId);
    let totalTokens = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    
    messages.forEach(message => {
      if (message.metadata?.tokenCount) {
        totalTokens += message.metadata.tokenCount;
      }
      if (message.metadata?.processingTime) {
        totalResponseTime += message.metadata.processingTime;
        responseCount++;
      }
    });
    
    return {
      ...stats,
      totalTokens: totalTokens > 0 ? totalTokens : undefined,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : undefined
    };
  }

  /**
   * Cleanup old conversations based on criteria
   * Requirements: 9.4
   */
  async cleanupConversations(criteria: {
    olderThan?: Date;
    maxConversations?: number;
    minMessageCount?: number;
  }): Promise<number> {
    const allConversations = await this.getAllConversations();
    let conversationsToDelete: string[] = [];
    
    if (criteria.olderThan) {
      conversationsToDelete = allConversations
        .filter(conv => conv.updatedAt < criteria.olderThan!)
        .map(conv => conv.id);
    }
    
    if (criteria.maxConversations && allConversations.length > criteria.maxConversations) {
      const sortedConversations = allConversations
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
      const excessCount = allConversations.length - criteria.maxConversations;
      conversationsToDelete = sortedConversations
        .slice(0, excessCount)
        .map(conv => conv.id);
    }
    
    if (criteria.minMessageCount) {
      const lowActivityConversations = allConversations
        .filter(conv => conv.messageCount < criteria.minMessageCount!)
        .map(conv => conv.id);
      conversationsToDelete = [...new Set([...conversationsToDelete, ...lowActivityConversations])];
    }
    
    // Delete conversations
    for (const conversationId of conversationsToDelete) {
      await this.deleteConversation(conversationId);
    }
    
    return conversationsToDelete.length;
  }

  /**
   * Generate a meaningful title for a conversation
   */
  private generateConversationTitle(conversation: ConversationState): string {
    if (conversation.messages.length === 0) {
      return 'Empty Conversation';
    }
    
    // Use first user message as title, truncated
    const firstUserMessage = conversation.messages.find(m => m.sender === 'user');
    if (firstUserMessage) {
      const title = firstUserMessage.content.substring(0, 50);
      return title.length < firstUserMessage.content.length ? `${title}...` : title;
    }
    
    // Fallback to timestamp
    return `Conversation from ${conversation.createdAt.toLocaleDateString()}`;
  }
}