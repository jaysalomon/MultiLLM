/**
 * Core chat message and conversation related TypeScript types
 */
import type { SharedMemoryContext } from './memory';
import type { LLMProvider, LLMRequest } from './providers';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | string; // 'user' or model identifier
  timestamp: Date;
  replyTo?: string; // For threading LLM-to-LLM conversations
  taskId?: string;
  metadata?: {
    model?: string;
    provider?: string;
    processingTime?: number;
    tokenCount?: number;
    error?: string;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

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

export interface ConversationState {
  id: string;
  participants: ModelParticipant[];
  messages: ChatMessage[];
  sharedMemory: SharedMemoryContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface LLMResponse {
  modelId: string;
  content: string | null;
  tool_calls?: ToolCall[];
  toolResults?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any> | null;
    output: string;
    error?: string;
  }>;
  metadata: {
    processingTime: number;
    tokenCount?: number;
    error?: string;
    finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface MessageThread {
  id: string;
  parentMessageId: string;
  participants: string[]; // Model IDs involved in the thread
  messages: ChatMessage[];
  createdAt: Date;
}

// Re-export LLMRequest for convenience
export type { LLMRequest };