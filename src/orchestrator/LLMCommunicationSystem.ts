/**
 * LLM-to-LLM Communication System
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import type { ChatMessage, LLMResponse, ModelParticipant } from '../types/chat';
import type { LLMRequest } from '../types/providers';

/**
 * Parsed mention from a message
 * Requirements: 7.2
 */
export interface ParsedMention {
  modelId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
  fullMention: string; // e.g., "@GPT-4"
}

/**
 * LLM-to-LLM message routing information
 * Requirements: 7.1, 7.2
 */
export interface MessageRouting {
  messageId: string;
  senderId: string; // Model ID that sent the message
  targetIds: string[]; // Model IDs that should receive this message
  isDirectMessage: boolean; // True if using @mentions
  mentionedModels: ParsedMention[];
  routingType: 'broadcast' | 'targeted' | 'reply';
}

/**
 * LLM conversation thread for multi-turn discussions
 * Requirements: 7.3
 */
export interface LLMConversationThread {
  id: string;
  parentMessageId?: string;
  participantIds: string[]; // Model IDs involved in this thread
  messages: ChatMessage[];
  threadType: 'llm-to-llm' | 'user-initiated' | 'mixed';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Context for multi-turn LLM discussions
 * Requirements: 7.4
 */
export interface LLMDiscussionContext {
  threadId: string;
  conversationHistory: ChatMessage[];
  activeParticipants: ModelParticipant[];
  discussionTopic?: string;
  contextSummary?: string;
  turnCount: number;
  lastActivity: Date;
}

/**
 * LLM Communication System for handling direct model interactions
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export class LLMCommunicationSystem {
  private threads: Map<string, LLMConversationThread> = new Map();
  private activeDiscussions: Map<string, LLMDiscussionContext> = new Map();
  private participants: Map<string, ModelParticipant> = new Map();

  /**
   * Parse @mentions from message content
   * Requirements: 7.2
   */
  parseMentions(content: string, availableModels: ModelParticipant[]): ParsedMention[] {
    const mentions: ParsedMention[] = [];
    const mentionRegex = /@([a-zA-Z0-9\-_]+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionText = match[1].trim();
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;
      const fullMention = match[0];

      // Find matching model by display name (case-insensitive)
      const matchedModel = availableModels.find(model => 
        model.displayName.toLowerCase() === mentionText.toLowerCase() ||
        model.id.toLowerCase() === mentionText.toLowerCase()
      );

      if (matchedModel) {
        mentions.push({
          modelId: matchedModel.id,
          displayName: matchedModel.displayName,
          startIndex,
          endIndex,
          fullMention
        });
      }
    }

    return mentions;
  }

  /**
   * Create message routing information
   * Requirements: 7.1, 7.2
   */
  createMessageRouting(
    message: ChatMessage,
    availableModels: ModelParticipant[],
    replyToMessage?: ChatMessage
  ): MessageRouting {
    const mentions = this.parseMentions(message.content, availableModels);
    const isDirectMessage = mentions.length > 0;
    
    let routingType: 'broadcast' | 'targeted' | 'reply' = 'broadcast';
    let targetIds: string[] = [];

    if (replyToMessage && message.sender !== 'user') {
      // This is a reply from an LLM
      routingType = 'reply';
      if (isDirectMessage) {
        targetIds = mentions.map(m => m.modelId);
      } else {
        targetIds = [replyToMessage.sender];
      }
    } else if (isDirectMessage) {
      // Direct message with @mentions
      routingType = 'targeted';
      targetIds = mentions.map(m => m.modelId);
    } else {
      // Broadcast to all active models
      routingType = 'broadcast';
      targetIds = availableModels.filter(m => m.isActive).map(m => m.id);
    }

    return {
      messageId: message.id,
      senderId: message.sender,
      targetIds,
      isDirectMessage,
      mentionedModels: mentions,
      routingType
    };
  }

  /**
   * Create or update LLM conversation thread
   * Requirements: 7.3
   */
  createOrUpdateThread(
    messageId: string,
    senderId: string,
    targetIds: string[],
    parentMessageId?: string
  ): string {
    // Check if this is part of an existing thread
    let threadId: string;
    let existingThread: LLMConversationThread | undefined;

    if (parentMessageId) {
      // Find thread containing the parent message
      existingThread = Array.from(this.threads.values()).find(thread =>
        thread.messages.some(msg => msg.id === parentMessageId)
      );
    }

    if (existingThread) {
      // Update existing thread
      threadId = existingThread.id;
      existingThread.participantIds = [...new Set([
        ...existingThread.participantIds,
        senderId,
        ...targetIds
      ])];
      existingThread.updatedAt = new Date();
      existingThread.isActive = true;
    } else {
      // Create new thread
      threadId = this.generateThreadId();
      const newThread: LLMConversationThread = {
        id: threadId,
        parentMessageId,
        participantIds: [senderId, ...targetIds],
        messages: [],
        threadType: senderId === 'user' ? 'user-initiated' : 'llm-to-llm',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      this.threads.set(threadId, newThread);
    }

    return threadId;
  }

  /**
   * Add message to thread
   * Requirements: 7.3
   */
  addMessageToThread(threadId: string, message: ChatMessage): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.messages.push(message);
      thread.updatedAt = new Date();
      
      // Update thread type if needed
      if (message.sender !== 'user' && thread.threadType === 'user-initiated') {
        thread.threadType = 'mixed';
      }
    }
  }

  /**
   * Create discussion context for multi-turn LLM conversations
   * Requirements: 7.4
   */
  createDiscussionContext(
    threadId: string,
    conversationHistory: ChatMessage[],
    activeParticipants: ModelParticipant[],
    discussionTopic?: string
  ): LLMDiscussionContext {
    const thread = this.threads.get(threadId);
    const turnCount = thread ? thread.messages.length : 0;

    const context: LLMDiscussionContext = {
      threadId,
      conversationHistory,
      activeParticipants,
      discussionTopic,
      contextSummary: this.generateContextSummary(conversationHistory, discussionTopic),
      turnCount,
      lastActivity: new Date()
    };

    this.activeDiscussions.set(threadId, context);
    return context;
  }

  /**
   * Update discussion context
   * Requirements: 7.4
   */
  updateDiscussionContext(
    threadId: string,
    newMessage: ChatMessage,
    updatedParticipants?: ModelParticipant[]
  ): void {
    const context = this.activeDiscussions.get(threadId);
    if (context) {
      context.conversationHistory.push(newMessage);
      context.turnCount += 1;
      context.lastActivity = new Date();
      
      if (updatedParticipants) {
        context.activeParticipants = updatedParticipants;
      }
      
      // Update context summary periodically
      if (context.turnCount % 5 === 0) {
        context.contextSummary = this.generateContextSummary(
          context.conversationHistory,
          context.discussionTopic
        );
      }
    }
  }

  /**
   * Route message to specific models
   * Requirements: 7.1
   */
  async routeMessage(
    routing: MessageRouting,
    message: ChatMessage,
    discussionContext: LLMDiscussionContext,
    sendRequest: (modelId: string, request: LLMRequest) => Promise<LLMResponse>
  ): Promise<Map<string, LLMResponse>> {
    const responses = new Map<string, LLMResponse>();
    
    // Create enhanced system prompt for LLM-to-LLM communication
    const systemPrompt = this.createLLMToLLMSystemPrompt(
      routing,
      discussionContext,
      message
    );

    // Convert discussion context to request messages
    const requestMessages = this.formatMessagesForLLM(
      discussionContext.conversationHistory,
      message,
      routing.senderId
    );

    // Send to target models
    const routingPromises = routing.targetIds.map(async (targetId) => {
      try {
        const request: LLMRequest = {
          providerId: targetId,
          messages: [
            { role: 'system', content: systemPrompt },
            ...requestMessages
          ],
          metadata: {
            conversationId: discussionContext.threadId,
            messageId: message.id,
            participantContext: discussionContext.activeParticipants.map(p => p.displayName)
          }
        };

        const response = await sendRequest(targetId, request);
        responses.set(targetId, response);
      } catch (error) {
        console.error(`Failed to route message to model ${targetId}:`, error);
        // Create error response
        responses.set(targetId, {
          modelId: targetId,
          content: '',
          metadata: {
            processingTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });

    await Promise.allSettled(routingPromises);
    return responses;
  }

  /**
   * Get active threads
   * Requirements: 7.3
   */
  getActiveThreads(): LLMConversationThread[] {
    return Array.from(this.threads.values()).filter(thread => thread.isActive);
  }

  /**
   * Get thread by ID
   * Requirements: 7.3
   */
  getThread(threadId: string): LLMConversationThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get discussion context
   * Requirements: 7.4
   */
  getDiscussionContext(threadId: string): LLMDiscussionContext | undefined {
    return this.activeDiscussions.get(threadId);
  }

  /**
   * Close thread
   * Requirements: 7.3
   */
  closeThread(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.isActive = false;
      thread.updatedAt = new Date();
    }
    
    this.activeDiscussions.delete(threadId);
  }

  /**
   * Update participants registry
   * Requirements: 7.1
   */
  updateParticipants(participants: ModelParticipant[]): void {
    this.participants.clear();
    participants.forEach(participant => {
      this.participants.set(participant.id, participant);
    });
  }

  /**
   * Generate thread ID
   * Requirements: 7.3
   */
  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate context summary for discussion
   * Requirements: 7.4
   */
  private generateContextSummary(
    messages: ChatMessage[],
    topic?: string
  ): string {
    if (messages.length === 0) {
      return topic || 'New discussion';
    }

    // Simple summary generation - in a real implementation, 
    // this could use an LLM to generate better summaries
    const recentMessages = messages.slice(-5);
    const participants = [...new Set(recentMessages.map(m => m.sender))];
    
    let summary = `Discussion between ${participants.join(', ')}`;
    if (topic) {
      summary += ` about ${topic}`;
    }
    
    summary += `. Recent activity: ${recentMessages.length} messages in the last exchange.`;
    
    return summary;
  }

  /**
   * Create system prompt for LLM-to-LLM communication
   * Requirements: 7.1, 7.2, 7.4
   */
  private createLLMToLLMSystemPrompt(
    routing: MessageRouting,
    context: LLMDiscussionContext,
    message: ChatMessage
  ): string {
    const participantNames = context.activeParticipants.map(p => p.displayName);
    const senderName = context.activeParticipants.find(p => p.id === routing.senderId)?.displayName || routing.senderId;
    
    let prompt = `You are participating in a multi-agent AI conversation.

Current participants: ${participantNames.join(', ')}
Thread context: ${context.contextSummary}
Turn count: ${context.turnCount}

`;

    if (routing.routingType === 'targeted' && routing.mentionedModels.length > 0) {
      const mentionedNames = routing.mentionedModels.map(m => m.displayName);
      prompt += `You have been specifically mentioned by ${senderName} along with: ${mentionedNames.join(', ')}
Please provide a thoughtful response that acknowledges being mentioned and addresses the content appropriately.

`;
    } else if (routing.routingType === 'reply') {
      prompt += `${senderName} is replying to a previous message in this thread.
Please continue the conversation naturally, building on the previous exchange.

`;
    } else {
      prompt += `This is a general message to all participants in the conversation.
Feel free to respond if you have something valuable to contribute.

`;
    }

    prompt += `Guidelines for LLM-to-LLM communication:
- Use @ModelName to address specific models when relevant
- Acknowledge and build upon other models' contributions
- Ask clarifying questions or provide alternative perspectives
- Be collaborative and constructive in your responses
- You can disagree respectfully and provide counterarguments
- Share relevant knowledge or insights that add value to the discussion

Remember: You are having a conversation with other AI models and potentially a human user. Be natural, helpful, and engaging.`;

    return prompt;
  }

  /**
   * Format messages for LLM request
   * Requirements: 7.4
   */
  private formatMessagesForLLM(
    conversationHistory: ChatMessage[],
    currentMessage: ChatMessage,
    excludeSenderId?: string
  ): Array<{ role: 'user' | 'assistant'; content: string; name?: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string; name?: string }> = [];

    // Add conversation history
    conversationHistory.forEach(msg => {
      if (msg.id !== currentMessage.id) {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          name: msg.sender !== 'user' ? msg.sender : undefined
        });
      }
    });

    // Add current message
    messages.push({
      role: currentMessage.sender === 'user' ? 'user' : 'assistant',
      content: currentMessage.content,
      name: currentMessage.sender !== 'user' ? currentMessage.sender : undefined
    });

    return messages;
  }
}
