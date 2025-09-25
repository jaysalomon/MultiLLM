/**
 * LLM Provider types and interfaces
 * Requirements: 4.1
 */

export enum ProviderType {
  Api = 'api',
  Ollama = 'ollama',
  LMStudio = 'lmstudio',
}

/**
 * Base LLM Provider interface
 * Requirements: 4.1
 */
export interface LLMProvider {
  id: string;
  name: string;
  type: ProviderType;
  config: ProviderConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base provider configuration
 * Requirements: 4.1
 */
export interface BaseProviderConfig {
  displayName: string;
  description?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeout?: number; // in milliseconds
}

/**
 * API-based provider configuration (OpenAI, Anthropic, etc.)
 * Requirements: 4.1
 */
export interface APIProviderConfig extends BaseProviderConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  organization?: string;
  headers?: Record<string, string>;
  rateLimitRpm?: number; // requests per minute
  rateLimitTpm?: number; // tokens per minute
}

/**
 * Ollama provider configuration
 * Requirements: 4.2
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  host: string; // e.g., 'http://localhost:11434'
  modelName: string;
  keepAlive?: string; // e.g., '5m', '-1' for indefinite
  numCtx?: number; // context window size
  numGpu?: number; // number of GPU layers
}

/**
 * LM Studio provider configuration
 * Requirements: 4.3
 */
export interface LMStudioProviderConfig extends BaseProviderConfig {
  host: string; // e.g., 'http://localhost:1234'
  modelName: string;
  apiKey?: string; // optional for LM Studio
}

/**
 * Union type for all provider configurations
 * Requirements: 4.1, 4.2, 4.3
 */
export type ProviderConfig = APIProviderConfig | OllamaProviderConfig | LMStudioProviderConfig;

/**
 * Provider connection status
 * Requirements: 4.1, 4.5
 */
export interface ProviderStatus {
  providerId: string;
  isConnected: boolean;
  lastChecked: Date;
  error?: string;
  latency?: number; // in milliseconds
  availableModels?: string[];
}

/**
 * Provider validation result
 * Requirements: 4.1, 4.5
 */
export interface ProviderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  availableModels?: string[];
}

/**
 * Defines the structure of a tool that can be called by the LLM.
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema object
  };
}

/**
 * Request to an LLM provider
 * Requirements: 3.1, 4.1
 */
export interface LLMRequest {
  providerId: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string; // for multi-agent identification
    tool_call_id?: string;
    tool_calls?: any[]; // Adjust as per actual ToolCall type
  }>;
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: {
    conversationId: string;
    messageId: string;
    participantContext: string[]; // other model names in conversation
  };
}