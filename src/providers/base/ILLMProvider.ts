import { ChatMessage, LLMResponse } from '../../types/chat';
import { Tool } from '../../types/providers';

export interface ILLMProvider {
  id: string;
  type: string;

  sendMessage(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      tools?: Tool[];
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
      stream?: boolean;
      model?: string;
    }
  ): Promise<LLMResponse>;

  streamMessage?(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      tools?: Tool[];
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
      model?: string;
    },
    onChunk?: (chunk: any) => void,
    onComplete?: (response: LLMResponse) => void,
    onError?: (error: Error) => void
  ): Promise<void>;

  listModels?(): Promise<string[]>;
  validateConfig?(): Promise<boolean>;
}