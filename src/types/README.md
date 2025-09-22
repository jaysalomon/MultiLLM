# Multi-LLM Chat Types

This directory contains all TypeScript interfaces and types for the Multi-LLM Chat application. The types are organized into logical modules that correspond to different aspects of the application.

## Structure

### Core Modules

- **`chat.ts`** - Chat-related interfaces (messages, conversations, participants)
- **`providers.ts`** - LLM provider configurations and interfaces
- **`memory.ts`** - Shared memory system interfaces
- **`config.ts`** - Application configuration interfaces

### Supporting Files

- **`index.ts`** - Main export file for all types
- **`__tests__/`** - Comprehensive unit tests for all type interfaces
- **`README.md`** - This documentation file

## Usage

Import types from the main index file:

```typescript
import {
  ChatMessage,
  ModelParticipant,
  LLMProvider,
  SharedMemoryContext,
  ApplicationConfiguration
} from '@/types';
```

Or import from specific modules:

```typescript
import { ChatMessage } from '@/types/chat';
import { APIProviderConfig } from '@/types/providers';
import { MemoryFact } from '@/types/memory';
```

## Type Categories

### Chat Types (`chat.ts`)

Core interfaces for chat functionality:

- **`ChatMessage`** - Individual chat messages with metadata
- **`ConversationState`** - Complete conversation state including participants and memory
- **`ModelParticipant`** - LLM models participating in conversations
- **`LLMResponse`** - Responses from LLM providers
- **`MessageThread`** - Threading for LLM-to-LLM conversations

### Provider Types (`providers.ts`)

Interfaces for LLM provider management:

- **`LLMProvider`** - Base provider interface
- **`APIProviderConfig`** - Configuration for API-based providers (OpenAI, Anthropic, etc.)
- **`OllamaProviderConfig`** - Configuration for Ollama local instances
- **`LMStudioProviderConfig`** - Configuration for LM Studio instances
- **`ProviderStatus`** - Connection and health status
- **`LLMRequest`** - Standardized request format for all providers

### Memory Types (`memory.ts`)

Interfaces for the shared memory system:

- **`SharedMemoryContext`** - Complete memory context for conversations
- **`MemoryFact`** - Individual facts stored in memory
- **`ConversationSummary`** - Summarized conversation segments
- **`EntityRelationship`** - Relationships between entities
- **`MemorySearchQuery`** - Search queries for memory retrieval
- **`MemoryExtractionRequest`** - Requests for extracting information from conversations

### Configuration Types (`config.ts`)

Application configuration interfaces:

- **`ApplicationConfiguration`** - Complete application configuration
- **`AppConfig`** - Core application settings
- **`ProviderSettings`** - Provider management settings
- **`MemorySettings`** - Memory system configuration
- **`UISettings`** - User interface preferences
- **`ExportSettings`** - Export/import preferences
- **`SecuritySettings`** - Security and privacy settings

## Validation

The types include comprehensive validation utilities in `../utils/validation.ts`:

```typescript
import { validateChatMessage, validateProviderConfig } from '@/utils/validation';

const message = { /* ... */ };
const result = validateChatMessage(message);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

## Requirements Mapping

The types are designed to fulfill specific requirements from the specification:

- **Requirement 1.3**: Multi-model conversation support → `ChatMessage`, `ModelParticipant`, `ConversationState`
- **Requirement 3.1**: Multi-agent awareness → `LLMRequest` with participant context
- **Requirement 4.1**: Provider configuration → `LLMProvider`, `ProviderConfig` types
- **Requirement 8.1**: Shared memory system → `SharedMemoryContext`, `MemoryFact`, etc.

## Testing

All types include comprehensive unit tests that verify:

- Interface structure and required fields
- Type safety and validation
- Edge cases and error conditions
- Integration between related types

Run tests with:

```bash
npm test
```

## Best Practices

1. **Type Safety**: All interfaces use strict typing with no `any` types
2. **Validation**: Use validation utilities before processing data
3. **Immutability**: Prefer readonly properties where appropriate
4. **Documentation**: All interfaces include JSDoc comments with requirement references
5. **Extensibility**: Interfaces are designed to be extended without breaking changes

## Future Considerations

- **Versioning**: Types include version fields for future migration support
- **Backwards Compatibility**: New fields should be optional to maintain compatibility
- **Performance**: Large objects include optional fields to minimize memory usage
- **Security**: Sensitive data (API keys) are clearly marked and handled appropriately