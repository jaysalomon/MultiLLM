/**
 * LLM Orchestrator for concurrent model management
 * Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 5.1, 5.2, 5.3
 */

import { LLMCommunicationSystem } from './LLMCommunicationSystem';
import { PerformanceRepository } from '../database/PerformanceRepository';
import { DatabaseManager } from '../database/DatabaseManager';
import { OllamaProvider } from '../providers/ollama/OllamaProvider';
import { APIProvider } from '../providers/api/APIProvider';
import { LMStudioProvider } from '../providers/lmstudio/LMStudioProvider';
import { toolExecutor } from '../tools/ToolExecutor';
import { toolRegistry } from '../tools/ToolRegistry';
import type { Tool, ToolCall, LLMRequest, LLMResponse, ModelParticipant } from '../types';
import type { ILLMProvider } from '../providers/base/ILLMProvider';
import type { Database } from 'better-sqlite3';
import type { ProviderConfig } from '../types/providers';
import type { ChatMessage } from '../types/chat';
import type { PerformanceMetric } from '../types/performance';
import type { MessageRouting, LLMConversationThread, LLMDiscussionContext } from './LLMCommunicationSystem';

// Placeholder section removed - real implementation is below starting at line 214

/**
 * Orchestrator response containing all model responses
 * Requirements: 2.1, 2.2
 */
export interface OrchestratorResponse {
  conversationId: string;
  messageId: string;
  responses: LLMResponse[];
  errors: Array<{
    modelId: string;
    error: Error;
  }>;
  metadata: {
    totalProcessingTime: number;
    successfulResponses: number;
    failedResponses: number;
  };
}

/**
 * Model lifecycle events
 * Requirements: 5.1, 5.2, 5.3
 */
export type ModelLifecycleEvent = 
  | { type: 'model_added'; participant: ModelParticipant }
  | { type: 'model_removed'; participantId: string }
  | { type: 'model_paused'; participantId: string }
  | { type: 'model_resumed'; participantId: string }
  | { type: 'model_error'; participantId: string; error: Error };

/**
 * Orchestrator configuration
 * Requirements: 1.1, 2.3
 */
export interface OrchestratorConfig {
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  retryAttempts?: number;
  errorIsolation?: boolean;
  toolCallMaxIterations?: number;
}

/**
 * LLM Orchestrator class for managing multiple active models
 * Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4
 */
export class LLMOrchestrator {
  private providers: Map<string, ILLMProvider> = new Map();
  private participants: Map<string, ModelParticipant> = new Map();
  private eventListeners: Array<(event: ModelLifecycleEvent) => void> = [];
  private config: OrchestratorConfig;
  private communicationSystem: LLMCommunicationSystem;
  private performanceRepository: PerformanceRepository | null = null;
  private availableTools: Tool[] = [];
  private toolCallMaxIterations: number;

  constructor(
    participantsOrDb: ModelParticipant[] | Database,
    providersOrConfig?: ILLMProvider[] | OrchestratorConfig,
    configParam?: OrchestratorConfig
  ) {
    // Handle both constructor signatures
    if (Array.isArray(participantsOrDb)) {
      // New signature: (participants, providers, config)
      const participants = participantsOrDb as ModelParticipant[];
      const providers = providersOrConfig as ILLMProvider[];
      const config = configParam || {};

      this.config = {
        maxConcurrentRequests: 10,
        requestTimeout: 30000,
        retryAttempts: 3,
        errorIsolation: true,
        ...config
      };

      this.toolCallMaxIterations = this.config.toolCallMaxIterations ?? 2;
      this.availableTools = toolRegistry.getAll();

      // Initialize with provided participants and providers
      participants.forEach(p => this.participants.set(p.id, p));
      providers.forEach(p => this.providers.set(p.id, p));

      this.communicationSystem = new LLMCommunicationSystem();
      // No database in this mode, so no performance repository
    } else {
      // Original signature: (db, config)
      const db = participantsOrDb as Database;
      const config = (providersOrConfig as OrchestratorConfig) || {};

      this.config = {
        maxConcurrentRequests: 10,
        requestTimeout: 30000,
        retryAttempts: 3,
        errorIsolation: true,
        ...config
      };

      this.toolCallMaxIterations = this.config.toolCallMaxIterations ?? 2;
      this.availableTools = toolRegistry.getAll();

      this.communicationSystem = new LLMCommunicationSystem();
      this.performanceRepository = new PerformanceRepository(db);
    }
  }

  /**
   * Add a model to the active conversation
   * Requirements: 5.1
   */
  async addModel(
    providerId: string,
    providerConfig: ProviderConfig,
    displayName: string,
    color: string = '#007acc'
  ): Promise<ModelParticipant> {
    // Create provider instance based on type
    const provider = this.createProvider(providerId, displayName, providerConfig);
    
    // Validate configuration
    const validation = await provider.validateConfig();
    if (!validation.isValid) {
      throw new Error(`Invalid provider configuration: ${validation.errors.join(', ')}`);
    }

    // Test connection
    const connectionTest = await provider.testConnection();
    if (!connectionTest.success) {
      throw new Error(`Failed to connect to provider: ${connectionTest.error}`);
    }

    // Create participant
    const participant: ModelParticipant = {
      id: providerId,
      provider: {
        id: providerId,
        name: displayName,
        type: provider.type as any,
        config: providerConfig,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      modelName: this.getModelNameFromConfig(providerConfig),
      displayName,
      color,
      isActive: true,
      addedAt: new Date()
    };

    // Store provider and participant
    this.providers.set(providerId, provider);
    this.participants.set(providerId, participant);

    // Update communication system participants
    this.communicationSystem.updateParticipants(Array.from(this.participants.values()));

    // Emit event
    this.emitEvent({ type: 'model_added', participant });

    return participant;
  }

  /**
   * Remove a model from the active conversation
   * Requirements: 5.2
   */
  async removeModel(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new Error(`Model with ID ${participantId} not found`);
    }

    // Remove from maps
    this.providers.delete(participantId);
    this.participants.delete(participantId);

    // Update communication system participants
    this.communicationSystem.updateParticipants(Array.from(this.participants.values()));

    // Emit event
    this.emitEvent({ type: 'model_removed', participantId });
  }

  /**
   * Pause a model (keep it in conversation but don't send requests)
   * Requirements: 5.2
   */
  async pauseModel(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new Error(`Model with ID ${participantId} not found`);
    }

    participant.isActive = false;
    participant.provider.isActive = false;

    // Emit event
    this.emitEvent({ type: 'model_paused', participantId });
  }

  /**
   * Resume a paused model
   * Requirements: 5.2
   */
  async resumeModel(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new Error(`Model with ID ${participantId} not found`);
    }

    // Test connection before resuming
    const provider = this.providers.get(participantId);
    if (provider) {
      const connectionTest = await provider.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Cannot resume model: ${connectionTest.error}`);
      }
    }

    participant.isActive = true;
    participant.provider.isActive = true;

    // Emit event
    this.emitEvent({ type: 'model_resumed', participantId });
  }

  /**
   * Send a message to all active models concurrently
   * Requirements: 1.1, 2.1, 2.2, 2.3
   */
  async sendToAllModels(
    messages: ChatMessage[],
    conversationId: string,
    messageId: string,
    systemPrompt?: string
  ): Promise<OrchestratorResponse> {
    const startTime = Date.now();
    const activeParticipants = Array.from(this.participants.values())
      .filter(p => p.isActive);

    if (activeParticipants.length === 0) {
      throw new Error('No active models available');
    }

    // Convert chat messages to LLM request format
    const requestMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      name: msg.sender !== 'user' ? msg.sender : undefined
    }));

    // Add multi-agent context to system prompt
    const participantNames = activeParticipants.map(p => p.displayName);
    const enhancedSystemPrompt = this.createMultiAgentSystemPrompt(
      systemPrompt,
      participantNames
    );

    // Create requests for each active model
    const requests = activeParticipants.map(participant => {
      const request: LLMRequest = {
        providerId: participant.id,
        messages: [
          ...(enhancedSystemPrompt ? [{ role: 'system' as const, content: enhancedSystemPrompt }] : []),
          ...requestMessages
        ],
        tools: this.availableTools.length ? this.availableTools : undefined,
        tool_choice: this.availableTools.length ? 'auto' : 'none',
        metadata: {
          conversationId,
          messageId,
          participantContext: participantNames
        }
      };
      return { participant, request };
    });

    // Execute requests concurrently with error isolation
    const responses: LLMResponse[] = [];
    const errors: Array<{ modelId: string; error: Error }> = [];

    const promises = requests.map(async ({ participant, request }) => {
      try {
        const provider = this.providers.get(participant.id);
        if (!provider) {
          throw new Error(`Provider not found for model ${participant.id}`);
        }

        const response = await this.executeWithTimeout<LLMResponse>(
          () => provider.sendRequest(request),
          this.config.requestTimeout!
        );

        const finalResponse = await this.processToolCalls(participant, request, response);

        responses.push(finalResponse);

        // Save performance metrics
        const performanceMetric: PerformanceMetric = {
          id: `perf_${messageId}`,
          message_id: messageId,
          model_id: participant.id,
          processing_time: finalResponse.metadata.processingTime,
          token_count: finalResponse.metadata.tokenCount,
          prompt_tokens: finalResponse.usage?.promptTokens,
          completion_tokens: finalResponse.usage?.completionTokens,
          error: finalResponse.metadata.error,
          created_at: new Date(),
        };
        if (this.performanceRepository) {
          await this.performanceRepository.create(performanceMetric);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        errors.push({ modelId: participant.id, error: err });

        // Emit error event
        this.emitEvent({ type: 'model_error', participantId: participant.id, error: err });

        // If error isolation is disabled, pause the model
        if (!this.config.errorIsolation) {
          await this.pauseModel(participant.id).catch(() => {
            // Ignore pause errors during error handling
          });
        }
      }
    });

    // Wait for all requests to complete
    await Promise.allSettled(promises);

    const totalProcessingTime = Date.now() - startTime;

    return {
      conversationId,
      messageId,
      responses,
      errors,
      metadata: {
        totalProcessingTime,
        successfulResponses: responses.length,
        failedResponses: errors.length
      }
    };
  }

  /**
   * Send a streaming message to all active models
   * Requirements: 2.2, 2.3
   */
  async sendStreamingToAllModels(
    messages: ChatMessage[],
    conversationId: string,
    messageId: string,
    onChunk: (modelId: string, chunk: string) => void,
    onComplete: (modelId: string, response: LLMResponse) => void,
    onError: (modelId: string, error: Error) => void,
    systemPrompt?: string
  ): Promise<void> {
    const activeParticipants = Array.from(this.participants.values())
      .filter(p => p.isActive);

    if (activeParticipants.length === 0) {
      throw new Error('No active models available');
    }

    // Convert chat messages to LLM request format
    const requestMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      name: msg.sender !== 'user' ? msg.sender : undefined
    }));

    // Add multi-agent context to system prompt
    const participantNames = activeParticipants.map(p => p.displayName);
    const enhancedSystemPrompt = this.createMultiAgentSystemPrompt(
      systemPrompt,
      participantNames
    );

    // Start streaming for each active model
    const streamingPromises = activeParticipants.map(async (participant) => {
      try {
        const provider = this.providers.get(participant.id);
        if (!provider) {
          throw new Error(`Provider not found for model ${participant.id}`);
        }

        const request: LLMRequest = {
          providerId: participant.id,
          messages: [
            ...(enhancedSystemPrompt ? [{ role: 'system' as const, content: enhancedSystemPrompt }] : []),
            ...requestMessages
          ],
          metadata: {
            conversationId,
            messageId,
            participantContext: participantNames
          }
        };

        await provider.sendStreamingRequest(
          request,
          (chunk) => onChunk(participant.id, chunk),
          (response) => {
            onComplete(participant.id, response);
            // Save performance metrics
            const performanceMetric: PerformanceMetric = {
              id: `perf_${messageId}`,
              message_id: messageId,
              model_id: participant.id,
              processing_time: response.metadata.processingTime,
              token_count: response.metadata.tokenCount,
              prompt_tokens: response.usage?.promptTokens,
              completion_tokens: response.usage?.completionTokens,
              error: response.metadata.error,
              created_at: new Date(),
            };
            if (this.performanceRepository) {
              void this.performanceRepository.create(performanceMetric);
            }
          },
          (error) => {
            onError(participant.id, error);
            this.emitEvent({ type: 'model_error', participantId: participant.id, error });
          }
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError(participant.id, err);
        this.emitEvent({ type: 'model_error', participantId: participant.id, error: err });
      }
    });

    // Wait for all streaming to complete
    await Promise.allSettled(streamingPromises);
  }

  /**
   * Get all active participants
   * Requirements: 1.3, 5.1
   */
  getActiveParticipants(): ModelParticipant[] {
    return Array.from(this.participants.values()).filter(p => p.isActive);
  }

  /**
   * Get all participants (active and paused)
   * Requirements: 1.3, 5.1
   */
  getAllParticipants(): ModelParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get a specific participant by ID
   * Requirements: 5.1
   */
  getParticipant(participantId: string): ModelParticipant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Add event listener for model lifecycle events
   * Requirements: 5.1, 5.2, 5.3
   */
  addEventListener(listener: (event: ModelLifecycleEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   * Requirements: 5.1, 5.2, 5.3
   */
  removeEventListener(listener: (event: ModelLifecycleEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Configure which registered tools are available to participants
   */
  setAvailableTools(toolNames?: string[]): void {
    if (!toolNames || toolNames.length === 0) {
      this.availableTools = toolRegistry.getAll();
      return;
    }

    const registryTools = toolRegistry.getAll();
    const selectedTools = registryTools.filter(tool =>
      toolNames.includes(tool.function.name)
    );

    this.availableTools = selectedTools;

    const missingTools = toolNames.filter(
      name => !selectedTools.some(tool => tool.function.name === name)
    );

    if (missingTools.length > 0) {
      console.warn('[LLMOrchestrator] Requested tools are not registered:', missingTools);
    }
  }

  /**
   * Retrieve the currently enabled tool definitions
   */
  getAvailableTools(): Tool[] {
    return [...this.availableTools];
  }

  /**
   * Health check all active models
   * Requirements: 2.4
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const activeParticipants = this.getActiveParticipants();

    const healthChecks = activeParticipants.map(async (participant) => {
      try {
        const provider = this.providers.get(participant.id);
        if (!provider) {
          results.set(participant.id, false);
          return;
        }

        const health = await provider.healthCheck();
        results.set(participant.id, health.healthy);
      } catch (error) {
        results.set(participant.id, false);
      }
    });

    await Promise.allSettled(healthChecks);
    return results;
  }

  /**
   * Create provider instance based on configuration
   * Requirements: 4.1, 4.2, 4.3
   */
  private createProvider(
    id: string,
    name: string,
    config: ProviderConfig
  ): ILLMProvider {
    // Type guard to determine provider type
    if ('apiKey' in config && 'baseUrl' in config) {
      return new APIProvider(id, name, config);
    } else if ('host' in config && 'keepAlive' in config) {
      return new OllamaProvider(id, name, config);
    } else if ('host' in config && !('keepAlive' in config)) {
      return new LMStudioProvider(id, name, config);
    } else {
      throw new Error(`Unsupported provider configuration type`);
    }
  }

  /**
   * Extract model name from provider configuration
   * Requirements: 4.1, 4.2, 4.3
   */
  private getModelNameFromConfig(config: ProviderConfig): string {
    return config.modelName || 'Unknown Model';
  }

  /**
   * Create multi-agent system prompt
   * Requirements: 3.1, 3.2, 3.3
   */
  private createMultiAgentSystemPrompt(
    basePrompt: string = '',
    participantNames: string[]
  ): string {
    const multiAgentContext = `
You are participating in a multi-agent conversation with other AI models and a human user.

Current participants: ${participantNames.join(', ')}
Your role: Collaborate and provide thoughtful responses while being aware of other participants.

Guidelines:
- You can respond to the user or address other AI participants directly
- Use @ModelName to address specific models when relevant
- Acknowledge and build upon other models' contributions when appropriate
- Contribute new information and perspectives to the shared knowledge base
- Be collaborative and respectful in discussions

${basePrompt ? `Additional context: ${basePrompt}` : ''}
`.trim();

    return multiAgentContext;
  }

  /**
   * Execute function with timeout
   * Requirements: 2.4
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Resolve tool calls by executing registered tools and looping until completion or limit
   */
  private async processToolCalls(
    participant: ModelParticipant,
    initialRequest: LLMRequest,
    initialResponse: LLMResponse
  ): Promise<LLMResponse> {
    if (!initialResponse.tool_calls?.length || this.availableTools.length === 0) {
      return initialResponse;
    }

    const provider = this.providers.get(participant.id);
    if (!provider) {
      return initialResponse;
    }

    const aggregatedMessages = initialRequest.messages.map(message => ({ ...message }));
    const executionLog: NonNullable<LLMResponse['toolResults']> = [];

    let iteration = 0;
    let currentResponse: LLMResponse = initialResponse;

    while (currentResponse.tool_calls?.length && iteration < this.toolCallMaxIterations) {
      iteration += 1;

      aggregatedMessages.push({
        role: 'assistant',
        content: currentResponse.content ?? '',
        tool_calls: currentResponse.tool_calls
      } as any);

      for (const call of currentResponse.tool_calls) {
        let parsedArgs: Record<string, any> | null = null;
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (error) {
          parsedArgs = null;
        }

        let output = '';
        let executionError: string | undefined;

        try {
          output = await toolExecutor.execute(call);
        } catch (error) {
          executionError = error instanceof Error ? error.message : 'Unknown error';
          output = JSON.stringify({ error: executionError });
        }

        executionLog.push({
          id: call.id || `${participant.id}_tool_${executionLog.length + 1}`,
          name: call.function.name,
          arguments: parsedArgs,
          output,
          error: executionError
        });

        aggregatedMessages.push({
          role: 'tool',
          content: output,
          name: call.function.name,
          tool_call_id: call.id
        } as any);
      }

      const followUpRequest: LLMRequest = {
        ...initialRequest,
        messages: aggregatedMessages.map(message => ({ ...message })),
        tools: this.availableTools,
        tool_choice: 'auto'
      };

      currentResponse = await this.executeWithTimeout<LLMResponse>(
        () => provider.sendRequest(followUpRequest),
        this.config.requestTimeout!
      );
    }

    if (executionLog.length) {
      currentResponse = {
        ...currentResponse,
        toolResults: currentResponse.toolResults
          ? [...currentResponse.toolResults, ...executionLog]
          : executionLog
      };
    }

    if (currentResponse.tool_calls?.length) {
      currentResponse = {
        ...currentResponse,
        metadata: {
          ...currentResponse.metadata,
          error: [
            currentResponse.metadata.error,
            `Unresolved tool calls after ${this.toolCallMaxIterations} iterations`
          ]
            .filter(Boolean)
            .join(' | ')
        }
      };
    }

    return currentResponse;
  }

  /**
   * Send message with LLM-to-LLM routing support
   * Requirements: 7.1, 7.2
   */
  async sendMessageWithRouting(
    message: ChatMessage,
    conversationHistory: ChatMessage[],
    conversationId: string,
    replyToMessage?: ChatMessage,
    systemPrompt?: string
  ): Promise<{
    responses: Map<string, LLMResponse>;
    routing: MessageRouting;
    threadId: string;
  }> {
    const availableModels = this.getActiveParticipants();
    
    // Create message routing
    const routing = this.communicationSystem.createMessageRouting(
      message,
      availableModels,
      replyToMessage
    );

    // Create or update conversation thread
    const threadId = this.communicationSystem.createOrUpdateThread(
      message.id,
      message.sender,
      routing.targetIds,
      replyToMessage?.id
    );

    // Add message to thread
    this.communicationSystem.addMessageToThread(threadId, message);

    // Create discussion context
    const discussionContext = this.communicationSystem.createDiscussionContext(
      threadId,
      conversationHistory,
      availableModels
    );

    // Route message to target models
    const responses = await this.communicationSystem.routeMessage(
      routing,
      message,
      discussionContext,
      async (modelId: string, request: LLMRequest) => {
        const provider = this.providers.get(modelId);
        if (!provider) {
          throw new Error(`Provider not found for model ${modelId}`);
        }
        return await provider.sendRequest(request);
      }
    );

    return { responses, routing, threadId };
  }

  /**
   * Handle LLM response and update discussion context
   * Requirements: 7.3, 7.4
   */
  async handleLLMResponse(
    response: LLMResponse,
    threadId: string,
    originalMessage: ChatMessage
  ): Promise<ChatMessage> {
    // Create response message
    const responseMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: response.content,
      sender: response.modelId,
      timestamp: new Date(),
      replyTo: originalMessage.id,
      metadata: {
        model: response.modelId,
        provider: this.getParticipant(response.modelId)?.provider.type || 'unknown',
        processingTime: response.metadata.processingTime,
        tokenCount: response.metadata.tokenCount,
        error: response.metadata.error
      }
    };

    // Save performance metrics
    const performanceMetric: PerformanceMetric = {
      id: `perf_${responseMessage.id}`,
      message_id: responseMessage.id,
      model_id: response.modelId,
      processing_time: response.metadata.processingTime,
      token_count: response.metadata.tokenCount,
      prompt_tokens: response.usage?.promptTokens,
      completion_tokens: response.usage?.completionTokens,
      error: response.metadata.error,
      created_at: new Date(),
    };
    if (this.performanceRepository) {
      await this.performanceRepository.create(performanceMetric);
    }

    // Add response to thread
    this.communicationSystem.addMessageToThread(threadId, responseMessage);

    // Update discussion context
    const activeParticipants = this.getActiveParticipants();
    this.communicationSystem.updateDiscussionContext(
      threadId,
      responseMessage,
      activeParticipants
    );

    return responseMessage;
  }

  /**
   * Get active conversation threads
   * Requirements: 7.3
   */
  getActiveThreads(): LLMConversationThread[] {
    return this.communicationSystem.getActiveThreads();
  }

  /**
   * Get conversation thread by ID
   * Requirements: 7.3
   */
  getThread(threadId: string): LLMConversationThread | undefined {
    return this.communicationSystem.getThread(threadId);
  }

  /**
   * Get discussion context for a thread
   * Requirements: 7.4
   */
  getDiscussionContext(threadId: string): LLMDiscussionContext | undefined {
    return this.communicationSystem.getDiscussionContext(threadId);
  }

  /**
   * Close a conversation thread
   * Requirements: 7.3
   */
  closeThread(threadId: string): void {
    this.communicationSystem.closeThread(threadId);
  }

  /**
   * Parse mentions in message content
   * Requirements: 7.2
   */
  parseMentions(content: string): Array<{
    modelId: string;
    displayName: string;
    startIndex: number;
    endIndex: number;
    fullMention: string;
  }> {
    const availableModels = this.getActiveParticipants();
    return this.communicationSystem.parseMentions(content, availableModels);
  }

  /**
   * Send streaming message with LLM-to-LLM routing support
   * Requirements: 7.1, 7.2, 2.2
   */
  async sendStreamingMessageWithRouting(
    message: ChatMessage,
    conversationHistory: ChatMessage[],
    conversationId: string,
    onChunk: (modelId: string, chunk: string, threadId: string) => void,
    onComplete: (modelId: string, response: LLMResponse, responseMessage: ChatMessage, threadId: string) => void,
    onError: (modelId: string, error: Error, threadId: string) => void,
    replyToMessage?: ChatMessage,
    systemPrompt?: string
  ): Promise<{
    routing: MessageRouting;
    threadId: string;
  }> {
    const availableModels = this.getActiveParticipants();
    
    // Create message routing
    const routing = this.communicationSystem.createMessageRouting(
      message,
      availableModels,
      replyToMessage
    );

    // Create or update conversation thread
    const threadId = this.communicationSystem.createOrUpdateThread(
      message.id,
      message.sender,
      routing.targetIds,
      replyToMessage?.id
    );

    // Add message to thread
    this.communicationSystem.addMessageToThread(threadId, message);

    // Create discussion context
    const discussionContext = this.communicationSystem.createDiscussionContext(
      threadId,
      conversationHistory,
      availableModels
    );

    // Create enhanced system prompt for LLM-to-LLM communication
    const enhancedSystemPrompt = this.createLLMToLLMSystemPrompt(
      systemPrompt,
      routing,
      discussionContext,
      message
    );

    // Convert chat messages to LLM request format
    const requestMessages = conversationHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
      name: msg.sender !== 'user' ? msg.sender : undefined
    }));

    // Add current message
    requestMessages.push({
      role: message.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: message.content,
      name: message.sender !== 'user' ? message.sender : undefined
    });

    // Start streaming for target models
    const streamingPromises = routing.targetIds.map(async (modelId) => {
      try {
        const provider = this.providers.get(modelId);
        if (!provider) {
          throw new Error(`Provider not found for model ${modelId}`);
        }

        const request: LLMRequest = {
          providerId: modelId,
          messages: [
            { role: 'system', content: enhancedSystemPrompt },
            ...requestMessages
          ],
          metadata: {
            conversationId,
            messageId: message.id,
            participantContext: availableModels.map(p => p.displayName)
          }
        };

        await provider.sendStreamingRequest(
          request,
          (chunk) => onChunk(modelId, chunk, threadId),
          (response) => {
            // Create response message and update context
            this.handleLLMResponse(response, threadId, message)
              .then(responseMessage => {
                onComplete(modelId, response, responseMessage, threadId);
              })
              .catch(error => {
                console.error('Error handling LLM response:', error);
              });
          },
          (error) => {
            onError(modelId, error, threadId);
            this.emitEvent({ type: 'model_error', participantId: modelId, error });
          }
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError(modelId, err, threadId);
        this.emitEvent({ type: 'model_error', participantId: modelId, error: err });
      }
    });

    // Wait for all streaming to start
    await Promise.allSettled(streamingPromises);

    return { routing, threadId };
  }

  /**
   * Create enhanced system prompt for LLM-to-LLM communication
   * Requirements: 7.1, 7.2, 7.4
   */
  private createLLMToLLMSystemPrompt(
    basePrompt: string = '',
    routing: MessageRouting,
    discussionContext: LLMDiscussionContext,
    message: ChatMessage
  ): string {
    const participantNames = discussionContext.activeParticipants.map(p => p.displayName);
    const senderName = discussionContext.activeParticipants.find(p => p.id === routing.senderId)?.displayName || routing.senderId;
    
    let prompt = `You are participating in a multi-agent AI conversation.

Current participants: ${participantNames.join(', ')}
Thread context: ${discussionContext.contextSummary}
Turn count: ${discussionContext.turnCount}

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

${basePrompt ? `Additional context: ${basePrompt}` : ''}

Remember: You are having a conversation with other AI models and potentially a human user. Be natural, helpful, and engaging.`;

    return prompt;
  }

  /**
   * Emit lifecycle event to all listeners
   * Requirements: 5.1, 5.2, 5.3
   */
  private emitEvent(event: ModelLifecycleEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }
}