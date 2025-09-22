# LLM Providers Module

This module implements the API-based provider handler for the Multi-LLM Chat application, supporting various LLM services like OpenAI, Anthropic, Cohere, and other API-compatible providers.

## Features

- **HTTP Client**: Built-in HTTP client using native fetch API
- **Authentication**: Secure API key management and request signing
- **Rate Limiting**: Configurable rate limiting with automatic enforcement
- **Streaming Support**: Real-time streaming responses for better UX
- **Error Handling**: Comprehensive error handling with retry logic
- **Multi-Provider Support**: Works with OpenAI, Anthropic, and other API providers
- **Type Safety**: Full TypeScript support with detailed type definitions

## Architecture

### Core Components

1. **BaseProvider**: Abstract base class with common functionality
2. **APIProvider**: Concrete implementation for API-based providers
3. **Error Classes**: Specialized error types for different failure scenarios
4. **Utility Functions**: Helper functions for common operations
5. **Type Definitions**: Comprehensive TypeScript interfaces

### Provider Hierarchy

```
BaseProvider (abstract)
├── APIProvider (for OpenAI, Anthropic, etc.)
├── OllamaProvider (future implementation)
└── LMStudioProvider (future implementation)
```

## Usage

### Basic Setup

```typescript
import { APIProvider } from './providers';
import type { APIProviderConfig } from './providers';

// Configure provider
const config: APIProviderConfig = {
  displayName: 'OpenAI GPT-4',
  apiKey: 'sk-your-api-key-here',
  baseUrl: 'https://api.openai.com/v1',
  modelName: 'gpt-4',
  maxTokens: 4096,
  temperature: 0.7,
  rateLimitRpm: 60,
  rateLimitTpm: 90000
};

// Create provider instance
const provider = new APIProvider('openai-1', 'OpenAI GPT-4', config);
```

### Sending Requests

```typescript
import type { LLMRequest } from './providers';

const request: LLMRequest = {
  providerId: 'openai-1',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  temperature: 0.7,
  maxTokens: 1000
};

// Regular request
const response = await provider.sendRequest(request);
console.log(response.content);

// Streaming request
await provider.sendStreamingRequest(
  request,
  (chunk) => console.log(chunk),
  (response) => console.log('Complete:', response.content),
  (error) => console.error('Error:', error)
);
```

### Multi-Agent Context

The provider automatically handles multi-agent conversation context:

```typescript
const multiAgentRequest: LLMRequest = {
  providerId: 'openai-1',
  messages: [
    {
      role: 'system',
      content: 'You are participating in a multi-agent conversation.'
    },
    { role: 'user', content: 'What do you think about renewable energy?' },
    {
      role: 'assistant',
      content: 'Renewable energy is crucial for sustainability.',
      name: 'claude-3'
    }
  ],
  systemPrompt: 'You are a helpful assistant. Other participants: Claude, Llama.',
  metadata: {
    conversationId: 'conv-123',
    messageId: 'msg-456',
    participantContext: ['gpt-4', 'claude-3', 'llama2']
  }
};
```

### Error Handling

```typescript
import {
  AuthenticationError,
  RateLimitError,
  NetworkError,
  ProviderError
} from './providers';

try {
  const response = await provider.sendRequest(request);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
    if (error.retryable) {
      // Retry logic here
    }
  } else if (error instanceof ProviderError) {
    console.error('Provider error:', error.message, error.code);
  }
}
```

### Configuration Validation

```typescript
// Validate configuration
const validation = await provider.validateConfig();
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
}
```

### Health Monitoring

```typescript
// Test connection
const connectionResult = await provider.testConnection();
if (connectionResult.success) {
  console.log('Available models:', connectionResult.availableModels);
} else {
  console.error('Connection failed:', connectionResult.error);
}

// Health check
const health = await provider.healthCheck();
console.log('Provider health:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
console.log('Latency:', health.latency, 'ms');
```

## Supported Providers

### OpenAI
- GPT-4, GPT-3.5 Turbo, and other models
- Full streaming support
- Organization header support
- Standard rate limiting

### Anthropic
- Claude 3 models (Opus, Sonnet, Haiku)
- Custom headers (anthropic-version)
- Streaming support
- Different response format handling

### Generic API Providers
- Any OpenAI-compatible API
- Custom headers and authentication
- Configurable endpoints
- Flexible response parsing

## Rate Limiting

The provider includes built-in rate limiting:

```typescript
const config: APIProviderConfig = {
  // ... other config
  rateLimitRpm: 60,    // Requests per minute
  rateLimitTpm: 90000  // Tokens per minute
};
```

Rate limits are enforced automatically and will throw `RateLimitError` when exceeded.

## Error Types

- **ProviderError**: Base error class
- **AuthenticationError**: Invalid API key or authentication failure
- **RateLimitError**: Rate limit exceeded (retryable)
- **QuotaExceededError**: API quota exceeded (not retryable)
- **NetworkError**: Network connectivity issues (retryable)
- **TimeoutError**: Request timeout (retryable)
- **ModelNotFoundError**: Requested model not available
- **InvalidRequestError**: Malformed request

## Testing

The module includes comprehensive tests:

```bash
npm test src/providers
```

Test coverage includes:
- Unit tests for all provider methods
- Integration tests with mock API responses
- Error handling scenarios
- Rate limiting behavior
- Streaming functionality
- Multi-provider configurations

## Requirements Fulfilled

This implementation satisfies the following requirements:

- **4.1**: API-based provider configuration and management
- **4.4**: Cross-platform compatibility and provider abstraction
- **2.4**: Comprehensive error handling and retry logic

## Future Enhancements

- Connection pooling for high-throughput scenarios
- Advanced retry strategies (circuit breaker pattern)
- Metrics collection and monitoring
- Provider-specific optimizations
- Caching layer for repeated requests