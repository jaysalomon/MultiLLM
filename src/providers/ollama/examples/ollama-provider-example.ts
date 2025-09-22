/**
 * Example usage of the Ollama Provider
 * Requirements: 4.2, 4.4, 2.4
 */

import { OllamaProvider } from '../OllamaProvider';
import type { OllamaProviderConfig, LLMRequest } from '../../../types';

/**
 * Example: Creating and using an Ollama provider with Llama2
 */
async function llama2Example() {
  // Configure Ollama provider for Llama2
  const llama2Config: OllamaProviderConfig = {
    displayName: 'Llama2 7B',
    host: 'http://localhost:11434',
    modelName: 'llama2',
    keepAlive: '5m',
    numCtx: 4096,
    numGpu: 1,
    temperature: 0.7,
    timeout: 60000 // 60 seconds for local models
  };

  // Create provider instance
  const provider = new OllamaProvider('llama2-local', 'Llama2 7B', llama2Config);

  // Test connection and validate configuration
  console.log('Testing Ollama connection...');
  const connectionResult = await provider.testConnection();
  if (!connectionResult.success) {
    console.error('Connection failed:', connectionResult.error);
    console.log('Available models:', connectionResult.availableModels);
    return;
  }
  console.log('Connection successful! Latency:', connectionResult.latency, 'ms');

  // Validate configuration
  const validation = await provider.validateConfig();
  if (!validation.isValid) {
    console.error('Configuration errors:', validation.errors);
    return;
  }
  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:', validation.warnings);
  }

  // Prepare a multi-agent conversation request
  const request: LLMRequest = {
    providerId: 'llama2-local',
    messages: [
      {
        role: 'system',
        content: 'You are participating in a multi-agent conversation with other AI models. Be collaborative and acknowledge other participants.'
      },
      {
        role: 'user',
        content: 'What are the advantages of using local LLM models like yourself?'
      }
    ],
    temperature: 0.7,
    maxTokens: 500,
    metadata: {
      conversationId: 'conv-123',
      messageId: 'msg-456',
      participantContext: ['llama2', 'gpt-4', 'claude-3']
    }
  };

  try {
    // Send regular request
    console.log('\nSending request to Llama2...');
    const response = await provider.sendRequest(request);
    console.log('Response:', response.content);
    console.log('Processing time:', response.metadata.processingTime, 'ms');
    console.log('Token count:', response.metadata.tokenCount);

    // Send streaming request
    console.log('\nSending streaming request...');
    let streamedContent = '';
    
    await provider.sendStreamingRequest(
      request,
      (chunk) => {
        process.stdout.write(chunk);
        streamedContent += chunk;
      },
      (finalResponse) => {
        console.log('\n\nStreaming complete!');
        console.log('Final content length:', finalResponse.content.length);
        console.log('Processing time:', finalResponse.metadata.processingTime, 'ms');
      },
      (error) => {
        console.error('Streaming error:', error.message);
      }
    );

  } catch (error) {
    console.error('Request failed:', error);
  }
}

/**
 * Example: Using Code Llama for code generation
 */
async function codeLlamaExample() {
  const codeLlamaConfig: OllamaProviderConfig = {
    displayName: 'Code Llama 7B',
    host: 'http://localhost:11434',
    modelName: 'codellama',
    keepAlive: '10m', // Keep loaded longer for coding sessions
    numCtx: 8192, // Larger context for code
    numGpu: 2,
    temperature: 0.1, // Lower temperature for more deterministic code
    timeout: 90000 // Longer timeout for complex code generation
  };

  const provider = new OllamaProvider('codellama-local', 'Code Llama 7B', codeLlamaConfig);

  // Test if Code Llama is available
  const models = await provider.getAvailableModels();
  if (!models.includes('codellama')) {
    console.log('Code Llama not available. Available models:', models);
    console.log('To install Code Llama, run: ollama pull codellama');
    return;
  }

  const codeRequest: LLMRequest = {
    providerId: 'codellama-local',
    messages: [
      {
        role: 'system',
        content: 'You are a code generation assistant. Provide clean, well-commented code.'
      },
      {
        role: 'user',
        content: 'Write a TypeScript function that implements a binary search algorithm with proper error handling.'
      }
    ],
    temperature: 0.1,
    maxTokens: 1000
  };

  try {
    const response = await provider.sendRequest(codeRequest);
    console.log('Generated code:\n', response.content);
  } catch (error) {
    console.error('Code generation failed:', error);
  }
}

/**
 * Example: Multi-agent conversation with Ollama models
 */
async function multiAgentExample() {
  // Create multiple Ollama providers for different models
  const llama2Provider = new OllamaProvider('llama2', 'Llama2', {
    displayName: 'Llama2 7B',
    host: 'http://localhost:11434',
    modelName: 'llama2',
    keepAlive: '5m'
  });

  const mistralProvider = new OllamaProvider('mistral', 'Mistral', {
    displayName: 'Mistral 7B',
    host: 'http://localhost:11434',
    modelName: 'mistral',
    keepAlive: '5m'
  });

  // Check which models are available
  const availableModels = await llama2Provider.getAvailableModels();
  console.log('Available models:', availableModels);

  const providers = [llama2Provider];
  if (availableModels.includes('mistral')) {
    providers.push(mistralProvider);
  }

  // Multi-agent conversation topic
  const topic = 'What are the ethical implications of AI development?';
  
  console.log(`\n=== Multi-Agent Discussion: ${topic} ===\n`);

  // Initial user message
  const baseRequest: LLMRequest = {
    providerId: '',
    messages: [
      {
        role: 'system',
        content: 'You are participating in a multi-agent discussion. Other AI models will also respond. Be thoughtful and build on others\' contributions.'
      },
      {
        role: 'user',
        content: topic
      }
    ],
    temperature: 0.8,
    maxTokens: 300
  };

  const responses: Array<{ provider: string; content: string }> = [];

  // Get responses from each provider
  for (const provider of providers) {
    try {
      const request = { ...baseRequest, providerId: provider.id };
      
      // Add previous responses to context
      if (responses.length > 0) {
        request.messages = [
          ...request.messages,
          ...responses.map(r => ({
            role: 'assistant' as const,
            content: r.content,
            name: r.provider
          }))
        ];
      }

      console.log(`\n--- ${provider.name} ---`);
      const response = await provider.sendRequest(request);
      console.log(response.content);
      
      responses.push({
        provider: provider.name,
        content: response.content
      });

    } catch (error) {
      console.error(`Error from ${provider.name}:`, error);
    }
  }

  console.log('\n=== Discussion Complete ===');
}

/**
 * Example: Error handling and recovery
 */
async function errorHandlingExample() {
  // Provider with non-existent model
  const invalidProvider = new OllamaProvider('invalid', 'Invalid Model', {
    displayName: 'Non-existent Model',
    host: 'http://localhost:11434',
    modelName: 'non-existent-model'
  });

  // Provider with wrong host
  const wrongHostProvider = new OllamaProvider('wrong-host', 'Wrong Host', {
    displayName: 'Wrong Host',
    host: 'http://localhost:9999',
    modelName: 'llama2'
  });

  const request: LLMRequest = {
    providerId: 'invalid',
    messages: [{ role: 'user', content: 'Hello' }]
  };

  console.log('=== Error Handling Examples ===\n');

  // Test model not found
  try {
    console.log('Testing with non-existent model...');
    await invalidProvider.sendRequest(request);
  } catch (error: any) {
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    console.log('Provider ID:', error.providerId);
    console.log('Retryable:', error.retryable);
  }

  // Test connection error
  try {
    console.log('\nTesting with wrong host...');
    await wrongHostProvider.sendRequest({ ...request, providerId: 'wrong-host' });
  } catch (error: any) {
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    console.log('Retryable:', error.retryable);
  }

  // Test health check with errors
  console.log('\nTesting health checks...');
  const invalidHealth = await invalidProvider.healthCheck();
  console.log('Invalid provider health:', invalidHealth.healthy ? 'HEALTHY' : 'UNHEALTHY');
  console.log('Error:', invalidHealth.error);

  const wrongHostHealth = await wrongHostProvider.healthCheck();
  console.log('Wrong host health:', wrongHostHealth.healthy ? 'HEALTHY' : 'UNHEALTHY');
  console.log('Error:', wrongHostHealth.error);
}

/**
 * Example: Model management operations
 */
async function modelManagementExample() {
  const provider = new OllamaProvider('manager', 'Model Manager', {
    displayName: 'Model Manager',
    host: 'http://localhost:11434',
    modelName: 'llama2'
  });

  console.log('=== Model Management ===\n');

  try {
    // List available models
    console.log('Fetching available models...');
    const models = await provider.getAvailableModels();
    console.log('Available models:', models);

    // Test connection for each model
    for (const modelName of models.slice(0, 3)) { // Test first 3 models
      const testProvider = new OllamaProvider(`test-${modelName}`, modelName, {
        displayName: modelName,
        host: 'http://localhost:11434',
        modelName
      });

      const connectionResult = await testProvider.testConnection();
      console.log(`${modelName}: ${connectionResult.success ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      if (!connectionResult.success) {
        console.log(`  Error: ${connectionResult.error}`);
      }
    }

  } catch (error) {
    console.error('Model management failed:', error);
  }
}

// Export examples for use in other files
export {
  llama2Example,
  codeLlamaExample,
  multiAgentExample,
  errorHandlingExample,
  modelManagementExample
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('=== Ollama Provider Examples ===\n');
  
  // Uncomment the examples you want to run:
  // llama2Example();
  // codeLlamaExample();
  // multiAgentExample();
  // errorHandlingExample();
  // modelManagementExample();
  
  console.log('Examples are commented out. Uncomment them to run with a local Ollama instance.');
  console.log('Make sure Ollama is running: ollama serve');
  console.log('Install models: ollama pull llama2, ollama pull mistral, ollama pull codellama');
}