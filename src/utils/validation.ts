/**
 * Validation utilities for data models
 * Requirements: 1.3, 3.1, 4.1, 8.1
 */

import type {
  ChatMessage,
  ModelParticipant,
  ConversationState,
  LLMResponse,
} from '../types/chat';
import type {
  LLMProvider,
  APIProviderConfig,
  OllamaProviderConfig,
  LMStudioProviderConfig,
  ProviderValidationResult,
} from '../types/providers';
import type {
  MemoryFact,
  ConversationSummary,
  EntityRelationship,
  SharedMemoryContext,
} from '../types/memory';
import type { ApplicationConfiguration } from '../types/config';

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a chat message
 */
export function validateChatMessage(message: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!message.id || typeof message.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'Message ID is required and must be a string',
      code: 'INVALID_ID',
    });
  }

  if (!message.content || typeof message.content !== 'string') {
    errors.push({
      field: 'content',
      message: 'Message content is required and must be a string',
      code: 'INVALID_CONTENT',
    });
  }

  if (!message.sender || typeof message.sender !== 'string') {
    errors.push({
      field: 'sender',
      message: 'Message sender is required and must be a string',
      code: 'INVALID_SENDER',
    });
  }

  if (!message.timestamp || !(message.timestamp instanceof Date)) {
    errors.push({
      field: 'timestamp',
      message: 'Message timestamp is required and must be a Date',
      code: 'INVALID_TIMESTAMP',
    });
  }

  if (message.replyTo && typeof message.replyTo !== 'string') {
    errors.push({
      field: 'replyTo',
      message: 'Reply to field must be a string if provided',
      code: 'INVALID_REPLY_TO',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a model participant
 */
export function validateModelParticipant(participant: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!participant.id || typeof participant.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'Participant ID is required and must be a string',
      code: 'INVALID_ID',
    });
  }

  if (!participant.modelName || typeof participant.modelName !== 'string') {
    errors.push({
      field: 'modelName',
      message: 'Model name is required and must be a string',
      code: 'INVALID_MODEL_NAME',
    });
  }

  if (!participant.displayName || typeof participant.displayName !== 'string') {
    errors.push({
      field: 'displayName',
      message: 'Display name is required and must be a string',
      code: 'INVALID_DISPLAY_NAME',
    });
  }

  if (!participant.color || typeof participant.color !== 'string') {
    errors.push({
      field: 'color',
      message: 'Color is required and must be a string',
      code: 'INVALID_COLOR',
    });
  }

  if (typeof participant.isActive !== 'boolean') {
    errors.push({
      field: 'isActive',
      message: 'isActive must be a boolean',
      code: 'INVALID_IS_ACTIVE',
    });
  }

  if (!participant.addedAt || !(participant.addedAt instanceof Date)) {
    errors.push({
      field: 'addedAt',
      message: 'addedAt is required and must be a Date',
      code: 'INVALID_ADDED_AT',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an LLM provider configuration
 */
export function validateProviderConfig(provider: any): ProviderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!provider.id || typeof provider.id !== 'string') {
    errors.push('Provider ID is required and must be a string');
  }

  if (!provider.name || typeof provider.name !== 'string') {
    errors.push('Provider name is required and must be a string');
  }

  if (!['api', 'ollama', 'lmstudio'].includes(provider.type)) {
    errors.push('Provider type must be one of: api, ollama, lmstudio');
  }

  if (!provider.config || typeof provider.config !== 'object') {
    errors.push('Provider config is required and must be an object');
  } else {
    // Validate type-specific configuration
    switch (provider.type) {
      case 'api':
        validateAPIProviderConfig(provider.config, errors, warnings);
        break;
      case 'ollama':
        validateOllamaProviderConfig(provider.config, errors, warnings);
        break;
      case 'lmstudio':
        validateLMStudioProviderConfig(provider.config, errors, warnings);
        break;
    }
  }

  if (typeof provider.isActive !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates API provider configuration
 */
function validateAPIProviderConfig(
  config: any,
  errors: string[],
  warnings: string[]
): void {
  if (!config.apiKey || typeof config.apiKey !== 'string') {
    errors.push('API key is required for API providers');
  }

  if (!config.baseUrl || typeof config.baseUrl !== 'string') {
    errors.push('Base URL is required for API providers');
  } else {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push('Base URL must be a valid URL');
    }
  }

  if (!config.modelName || typeof config.modelName !== 'string') {
    errors.push('Model name is required for API providers');
  }

  if (config.maxTokens && (typeof config.maxTokens !== 'number' || config.maxTokens <= 0)) {
    warnings.push('Max tokens should be a positive number');
  }

  if (config.temperature && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
    warnings.push('Temperature should be a number between 0 and 2');
  }
}

/**
 * Validates Ollama provider configuration
 */
function validateOllamaProviderConfig(
  config: any,
  errors: string[],
  warnings: string[]
): void {
  if (!config.host || typeof config.host !== 'string') {
    errors.push('Host is required for Ollama providers');
  } else {
    try {
      new URL(config.host);
    } catch {
      errors.push('Host must be a valid URL');
    }
  }

  if (!config.modelName || typeof config.modelName !== 'string') {
    errors.push('Model name is required for Ollama providers');
  }

  if (config.numCtx && (typeof config.numCtx !== 'number' || config.numCtx <= 0)) {
    warnings.push('Context size should be a positive number');
  }

  if (config.numGpu && (typeof config.numGpu !== 'number' || config.numGpu < 0)) {
    warnings.push('GPU layers should be a non-negative number');
  }
}

/**
 * Validates LM Studio provider configuration
 */
function validateLMStudioProviderConfig(
  config: any,
  errors: string[],
  warnings: string[]
): void {
  if (!config.host || typeof config.host !== 'string') {
    errors.push('Host is required for LM Studio providers');
  } else {
    try {
      new URL(config.host);
    } catch {
      errors.push('Host must be a valid URL');
    }
  }

  if (!config.modelName || typeof config.modelName !== 'string') {
    errors.push('Model name is required for LM Studio providers');
  }
}

/**
 * Validates a memory fact
 */
export function validateMemoryFact(fact: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!fact.id || typeof fact.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'Fact ID is required and must be a string',
      code: 'INVALID_ID',
    });
  }

  if (!fact.content || typeof fact.content !== 'string') {
    errors.push({
      field: 'content',
      message: 'Fact content is required and must be a string',
      code: 'INVALID_CONTENT',
    });
  }

  if (!fact.source || typeof fact.source !== 'string') {
    errors.push({
      field: 'source',
      message: 'Fact source is required and must be a string',
      code: 'INVALID_SOURCE',
    });
  }

  if (!fact.timestamp || !(fact.timestamp instanceof Date)) {
    errors.push({
      field: 'timestamp',
      message: 'Fact timestamp is required and must be a Date',
      code: 'INVALID_TIMESTAMP',
    });
  }

  if (typeof fact.relevanceScore !== 'number' || fact.relevanceScore < 0 || fact.relevanceScore > 1) {
    errors.push({
      field: 'relevanceScore',
      message: 'Relevance score must be a number between 0 and 1',
      code: 'INVALID_RELEVANCE_SCORE',
    });
  }

  if (!Array.isArray(fact.tags)) {
    errors.push({
      field: 'tags',
      message: 'Tags must be an array',
      code: 'INVALID_TAGS',
    });
  }

  if (typeof fact.verified !== 'boolean') {
    errors.push({
      field: 'verified',
      message: 'Verified must be a boolean',
      code: 'INVALID_VERIFIED',
    });
  }

  if (!Array.isArray(fact.references)) {
    errors.push({
      field: 'references',
      message: 'References must be an array',
      code: 'INVALID_REFERENCES',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a shared memory context
 */
export function validateSharedMemoryContext(context: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!context.conversationId || typeof context.conversationId !== 'string') {
    errors.push({
      field: 'conversationId',
      message: 'Conversation ID is required and must be a string',
      code: 'INVALID_CONVERSATION_ID',
    });
  }

  if (!Array.isArray(context.facts)) {
    errors.push({
      field: 'facts',
      message: 'Facts must be an array',
      code: 'INVALID_FACTS',
    });
  }

  if (!Array.isArray(context.summaries)) {
    errors.push({
      field: 'summaries',
      message: 'Summaries must be an array',
      code: 'INVALID_SUMMARIES',
    });
  }

  if (!Array.isArray(context.relationships)) {
    errors.push({
      field: 'relationships',
      message: 'Relationships must be an array',
      code: 'INVALID_RELATIONSHIPS',
    });
  }

  if (!context.lastUpdated || !(context.lastUpdated instanceof Date)) {
    errors.push({
      field: 'lastUpdated',
      message: 'Last updated is required and must be a Date',
      code: 'INVALID_LAST_UPDATED',
    });
  }

  if (typeof context.version !== 'number' || context.version < 0) {
    errors.push({
      field: 'version',
      message: 'Version must be a non-negative number',
      code: 'INVALID_VERSION',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates application configuration
 */
export function validateApplicationConfig(config: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (!config.app || typeof config.app !== 'object') {
    errors.push({
      field: 'app',
      message: 'App configuration is required and must be an object',
      code: 'INVALID_APP_CONFIG',
    });
  }

  if (!config.providers || typeof config.providers !== 'object') {
    errors.push({
      field: 'providers',
      message: 'Provider configuration is required and must be an object',
      code: 'INVALID_PROVIDER_CONFIG',
    });
  }

  if (!config.memory || typeof config.memory !== 'object') {
    errors.push({
      field: 'memory',
      message: 'Memory configuration is required and must be an object',
      code: 'INVALID_MEMORY_CONFIG',
    });
  }

  if (!config.ui || typeof config.ui !== 'object') {
    errors.push({
      field: 'ui',
      message: 'UI configuration is required and must be an object',
      code: 'INVALID_UI_CONFIG',
    });
  }

  if (!config.export || typeof config.export !== 'object') {
    errors.push({
      field: 'export',
      message: 'Export configuration is required and must be an object',
      code: 'INVALID_EXPORT_CONFIG',
    });
  }

  if (!config.security || typeof config.security !== 'object') {
    errors.push({
      field: 'security',
      message: 'Security configuration is required and must be an object',
      code: 'INVALID_SECURITY_CONFIG',
    });
  }

  if (!config.configVersion || typeof config.configVersion !== 'string') {
    errors.push({
      field: 'configVersion',
      message: 'Config version is required and must be a string',
      code: 'INVALID_CONFIG_VERSION',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}