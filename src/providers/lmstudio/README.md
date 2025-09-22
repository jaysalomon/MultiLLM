# LM Studio Provider

This module implements the LM Studio provider for the Multi-LLM Chat application, enabling communication with local LLM instances running through LM Studio's OpenAI-compatible API.

## Features

- **OpenAI-Compatible API**: Uses LM Studio's OpenAI-compatible endpoints
- **Model Discovery**: Automatic detection of available models
- **Connection Management**: Health monitoring and connection testing
- **Streaming Support**: Real-time streaming responses
- **Error Handling**: Comprehensive error handling for LM Studio-specific issues
- **Optional Authentication**: Support for API keys (though typically not required)
- **Type Safety**: Full TypeScript support with detailed type definitions

## Requirements

- LM Studio application running locally
- LM Studio server started (typically on port 1234)
- At least one model loaded in LM Studio

## Configuration

### Basic Configuration

```typescript
import { LMStudioProvider } from './providers/lmstudio';
import type { LMStudioProviderConfig } from './types';

const config: LMStudioProviderConfig = {
  displayName: 'LM Studio Llama 2',
  host: 'http://localhost:1234',
  modelName: 'llama-2-7b-chat',
  maxTokens: 4096,
  temperature: 0.7
};

const provider = new LMStudioProvider('lmstudio-1', 'LM Studio Llama 2', config);
```

### Advanced Configuration

```typescript
const config: LMStudioProviderConfig = {
  displayName: 'LM Studio Custom Model',
  host: 'http://localhost:1234',
  modelName: 'custom-model-name',
  apiKey: 'optional-api-key', // Usually not required
  maxTokens: 8192,
  temperature: 0.8,
  topP: 0.9,
  timeout: 60000 // 60 seconds
};
```

## Usage

### Basic Request

```typescript
import type { LLMRequest } from './types';

const request: LLMRequest = {
  providerId: 'lmstudio-1',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  temperature: 0.7,
  maxTokens: 1000
};

const response = await provider.sendRequest(request);
console.log(response.content);
```

### Streaming Request

```typescript
await provider.sendStreamingRequest(
  request,
  (chunk) => console.log(chunk),
  (response) => console.log('Complete:', response.content),
  (error) => console.error('Error:', error)
);
```

### Multi-Agent Context

```typescript
const multiAgentRequest: LLMRequest = {
  providerId: 'lmstudio-1',
  messages: [
    {
      role: 'system',
      content: 'You are participating in a multi-agent conversation with other AI models.'
    },
    { role: 'user', content: 'What are your thoughts on AI collaboration?' },
    {
      role: 'assistant',
      content: 'AI collaboration can lead to more comprehensive solutions.',
      name: 'gpt-4'
    }
  ],
  metadata: {
    conversationId: 'conv-123',
    messageId: 'msg-456',
    participantContext: ['gpt-4', 'claude-3', 'lmstudio-llama2']
  }
};
```

## Model Discovery

```typescript
// Get available models
const models = await provider.getAvailableModels();
console.log('Available models:', models);

// Test connection and get models
const connectionResult = await provider.testConnection();
if (connectionResult.success) {
  console.log('Available models:', connectionResult.availableModels);
} else {
  console.error('Connection failed:', connectionResult.error);
}
```

## Error Handling

```typescript
import {
  AuthenticationError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError,
  ProviderError
} from './providers/errors';

try {
  const response = await provider.sendRequest(request);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
    if (error.retryable) {
      // Retry logic here
    }
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof ModelNotFoundError) {
    console.error('Model not found:', error.message);
  } else if (error instanceof ProviderError) {
    console.error('Provider error:', error.message, error.code);
  }
}
```

## Configuration Validation

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

## Health Monitoring

```typescript
// Test connection
const connectionResult = await provider.testConnection();
console.log('Connection status:', connectionResult.success);
console.log('Latency:', connectionResult.latency, 'ms');

// Health check
const health = await provider.healthCheck();
console.log('Provider health:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
console.log('Last checked:', health.lastChecked);
```

## LM Studio Setup

### Starting LM Studio Server

1. Open LM Studio application
2. Load a model in the "Chat" tab
3. Go to the "Local Server" tab
4. Click "Start Server" (default port is 1234)
5. Verify the server is running by visiting `http://localhost:1234/v1/models`

### Model Management

- Models must be loaded in LM Studio before they can be used
- The model name in the configuration must match the model ID from `/v1/models`
- Only one model can be active at a time in LM Studio (unless using multiple instances)

## API Compatibility

LM Studio uses OpenAI-compatible endpoints:

- **Models**: `GET /v1/models`
- **Chat Completions**: `POST /v1/chat/completions`
- **Streaming**: Same endpoint with `stream: true`

## Rate Limiting

The provider includes conservative rate limiting:

```typescript
const rateLimits = {
  requestsPerMinute: 120,  // Higher than Ollama
  tokensPerMinute: 20000   // Conservative default
};
```

## Error Types

- **NetworkError**: Connection issues with LM Studio
- **TimeoutError**: Request timeout (configurable)
- **ModelNotFoundError**: Requested model not loaded in LM Studio
- **AuthenticationError**: Invalid API key (if used)
- **InvalidRequestError**: Malformed request
- **ProviderError**: General LM Studio-specific errors

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure LM Studio is running
   - Verify the server is started in LM Studio
   - Check the host URL and port

2. **Model Not Found**
   - Load the model in LM Studio's Chat tab
   - Verify the model name matches the ID from `/v1/models`
   - Restart LM Studio if the model list is stale

3. **Slow Responses**
   - Check system resources (CPU, RAM, GPU)
   - Consider using a smaller model
   - Adjust the timeout setting

4. **Streaming Issues**
   - Ensure LM Studio supports streaming for the loaded model
   - Check network connectivity
   - Verify the request format

## Requirements Fulfilled

This implementation satisfies the following requirements:

- **4.3**: LM Studio provider configuration and management
- **4.4**: Cross-platform compatibility and provider abstraction
- **2.4**: Comprehensive error handling and retry logic

## Future Enhancements

- Support for multiple LM Studio instances
- Advanced model switching without server restart
- Performance metrics collection
- Custom prompt templates for different model types
- Integration with LM Studio's model management API