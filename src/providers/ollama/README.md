# Ollama Provider

This module implements the Ollama provider handler for the Multi-LLM Chat application, enabling communication with local Ollama instances running various open-source language models.

## Features

- **Local Model Support**: Connect to locally running Ollama instances
- **Model Discovery**: Automatic detection of available models
- **Connection Health Monitoring**: Real-time monitoring of Ollama instance status
- **Model Loading/Unloading**: Efficient model lifecycle management
- **Streaming Support**: Real-time streaming responses for better UX
- **Error Handling**: Comprehensive error handling with retry logic
- **Multi-Agent Context**: Full support for multi-agent conversation context
- **Type Safety**: Full TypeScript support with detailed type definitions

## Requirements

- **Ollama Instance**: Local Ollama server running (default: `http://localhost:11434`)
- **Models**: At least one model pulled and available (e.g., `llama2`, `mistral`, `codellama`)

## Installation and Setup

### 1. Install Ollama

Visit [Ollama's official website](https://ollama.ai) or install via package manager:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 2. Start Ollama Server

```bash
ollama serve
```

### 3. Pull Models

```bash
# Popular models
ollama pull llama2          # Meta's Llama 2 (7B)
ollama pull mistral         # Mistral 7B
ollama pull codellama       # Code Llama for programming
ollama pull llama2:13b      # Larger Llama 2 model
ollama pull phi             # Microsoft's Phi model
```

## Usage

### Basic Setup

```typescript
import { OllamaProvider } from './providers/ollama';
import type { OllamaProviderConfig } from './types';

// Configure Ollama provider
const config: OllamaProviderConfig = {
  displayName: 'Llama2 7B Local',
  host: 'http://localhost:11434',
  modelName: 'llama2',
  keepAlive: '5m',
  numCtx: 4096,
  numGpu: 1,
  temperature: 0.7,
  timeout: 60000
};

// Create provider instance
const provider = new OllamaProvider('llama2-local', 'Llama2 Local', config);
```

### Configuration Options

```typescript
interface OllamaProviderConfig {
  displayName: string;        // Display name for the provider
  host: string;              // Ollama server URL (e.g., 'http://localhost:11434')
  modelName: string;         // Model name (e.g., 'llama2', 'mistral')
  keepAlive?: string;        // Keep model loaded ('5m', '1h', '-1' for indefinite)
  numCtx?: number;           // Context window size (default: model's default)
  numGpu?: number;           // Number of GPU layers to use
  temperature?: number;      // Sampling temperature (0.0 - 2.0)
  timeout?: number;          // Request timeout in milliseconds
}
```

### Sending Requests

```typescript
import type { LLMRequest } from './types';

const request: LLMRequest = {
  providerId: 'llama2-local',
  messages: [
    { role: 'user', content: 'Explain quantum computing in simple terms' }
  ],
  temperature: 0.7,
  maxTokens: 500
};

// Regular request
const response = await provider.sendRequest(request);
console.log(response.content);

// Streaming request
await provider.sendStreamingRequest(
  request,
  (chunk) => process.stdout.write(chunk),
  (response) => console.log('\nComplete!'),
  (error) => console.error('Error:', error)
);
```

### Multi-Agent Context

The Ollama provider automatically handles multi-agent conversation context:

```typescript
const multiAgentRequest: LLMRequest = {
  providerId: 'llama2-local',
  messages: [
    {
      role: 'system',
      content: 'You are participating in a multi-agent conversation with other AI models.'
    },
    { role: 'user', content: 'What are the benefits of open-source AI?' },
    {
      role: 'assistant',
      content: 'Open-source AI promotes transparency and collaboration.',
      name: 'gpt-4'
    }
  ],
  metadata: {
    conversationId: 'conv-123',
    messageId: 'msg-456',
    participantContext: ['llama2', 'gpt-4', 'claude-3']
  }
};

const response = await provider.sendRequest(multiAgentRequest);
// Llama2 will be aware of GPT-4's previous response and can reference it
```

### Model Management

```typescript
// Test connection and get available models
const connectionResult = await provider.testConnection();
if (connectionResult.success) {
  console.log('Available models:', connectionResult.availableModels);
} else {
  console.error('Connection failed:', connectionResult.error);
}

// Get all available models
const models = await provider.getAvailableModels();
console.log('All models:', models);

// Health check
const health = await provider.healthCheck();
console.log('Health:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
console.log('Latency:', health.latency, 'ms');
```

### Error Handling

```typescript
import {
  ProviderError,
  NetworkError,
  TimeoutError,
  ModelNotFoundError
} from './providers/errors';

try {
  const response = await provider.sendRequest(request);
} catch (error) {
  if (error instanceof ModelNotFoundError) {
    console.error('Model not available:', error.message);
    // Suggest pulling the model: ollama pull <model-name>
  } else if (error instanceof NetworkError) {
    console.error('Connection error:', error.message);
    // Check if Ollama server is running
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
    // Consider increasing timeout or using a smaller model
  } else if (error instanceof ProviderError) {
    console.error('Provider error:', error.message);
    console.log('Retryable:', error.retryable);
  }
}
```

### Configuration Validation

```typescript
// Validate configuration before use
const validation = await provider.validateConfig();
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  // Fix configuration issues
}

if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
  // Address warnings if needed
}
```

## Supported Models

The Ollama provider works with any model available in the Ollama model library:

### Popular Models

- **llama2** (7B, 13B, 70B) - Meta's Llama 2 models
- **mistral** (7B) - Mistral AI's efficient model
- **codellama** (7B, 13B, 34B) - Code-specialized Llama models
- **phi** (2.7B) - Microsoft's compact model
- **neural-chat** (7B) - Intel's conversational model
- **starling-lm** (7B) - Berkeley's RLHF-trained model
- **openchat** (7B) - OpenChat conversational model
- **wizardcoder** (15B, 34B) - Code generation models

### Model Selection Tips

- **7B models**: Good balance of speed and quality for most tasks
- **13B+ models**: Better quality but slower, require more resources
- **Code models**: Specialized for programming tasks (codellama, wizardcoder)
- **Chat models**: Optimized for conversation (neural-chat, openchat)

## Performance Optimization

### GPU Acceleration

```typescript
const config: OllamaProviderConfig = {
  // ... other config
  numGpu: 32,  // Use all available GPU layers
  numCtx: 8192 // Larger context for complex tasks
};
```

### Memory Management

```typescript
const config: OllamaProviderConfig = {
  // ... other config
  keepAlive: '10m',  // Keep model loaded for 10 minutes
  // Use '-1' for indefinite loading if you use the model frequently
  // Use '0' to unload immediately after each request
};
```

### Concurrent Requests

The provider supports concurrent requests to the same Ollama instance:

```typescript
const requests = [
  provider.sendRequest(request1),
  provider.sendRequest(request2),
  provider.sendRequest(request3)
];

const responses = await Promise.all(requests);
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Make sure Ollama is running
   ollama serve
   ```

2. **Model Not Found**
   ```bash
   # Pull the required model
   ollama pull llama2
   ```

3. **Slow Responses**
   - Use smaller models (7B instead of 13B+)
   - Increase GPU layers (`numGpu`)
   - Reduce context window (`numCtx`)

4. **Out of Memory**
   - Use smaller models
   - Reduce `numCtx`
   - Reduce `numGpu` layers

### Health Monitoring

```typescript
// Regular health checks
setInterval(async () => {
  const health = await provider.healthCheck();
  if (!health.healthy) {
    console.warn('Ollama provider unhealthy:', health.error);
  }
}, 30000); // Check every 30 seconds
```

## Requirements Fulfilled

This implementation satisfies the following requirements:

- **4.2**: Ollama provider configuration and model selection
- **4.4**: Cross-platform compatibility and provider abstraction
- **2.4**: Comprehensive error handling and retry logic

## Testing

Run the comprehensive test suite:

```bash
npm test src/providers/ollama/__tests__/OllamaProvider.test.ts
```

The tests include:
- Configuration validation
- Connection testing with mock responses
- Request/response handling
- Streaming functionality
- Error scenarios
- Multi-agent context handling
- Rate limiting behavior

## Examples

See `src/providers/ollama/examples/ollama-provider-example.ts` for comprehensive usage examples including:
- Basic model interaction
- Code generation with Code Llama
- Multi-agent conversations
- Error handling patterns
- Model management operations