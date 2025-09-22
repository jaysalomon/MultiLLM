/**
 * Core chat message interface
 * Requirements: 1.3, 3.1
 */
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | string; // 'user' or model identifier
  timestamp: Date;
  replyTo?: string; // For threading LLM-to-LLM conversations
  taskId?: string;
  metadata?: {
    model: string;
    provider: string;
    processingTime?: number;
    tokenCount?: number;
    error?: string;
  };
}

/**
 * Conversation state interface
 * Requirements: 1.3, 3.1, 8.1
 */
export interface ConversationState {
  id: string;
  participants: ModelParticipant[];
  messages: ChatMessage[];
  sharedMemory: SharedMemoryContext;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Model participant in a conversation
 * Requirements: 1.3, 4.1
 */
export interface ModelParticipant {
  id: string;
  provider: LLMProvider;
  modelName: string;
  displayName: string;
  color: string;
  avatar?: string;
  isActive: boolean;
  addedAt: Date;
}

/**
 * Response from an LLM
 * Requirements: 1.3, 3.1
 */
export interface LLMResponse {
  modelId: string;
  content: string;
  metadata: {
    processingTime: number;
    tokenCount?: number;
    error?: string;
    finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call';
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Message thread for LLM-to-LLM conversations
 * Requirements: 3.1
 */
export interface MessageThread {
  id: string;
  parentMessageId: string;
  participants: string[]; // Model IDs involved in the thread
  messages: ChatMessage[];
  createdAt: Date;
}

// Import SharedMemoryContext from memory types
import type { SharedMemoryContext } from './memory';
import type { LLMProvider, LLMRequest } from './providers';

// Re-export LLMRequest for convenience
export type { LLMRequest };