/**
 * Example usage of the API Provider
 * Requirements: 4.1, 4.4, 2.4
 */

import { APIProvider } from '../api/APIProvider';
import type { APIProviderConfig, LLMRequest } from '../../types';

/**
 * Example: Creating and using an OpenAI provider
 */
async function openAIExample() {
  // Configure OpenAI provider
  const openAIConfig: APIProviderConfig = {
    displayName: 'OpenAI GPT-4',
    apiKey: 'sk-your-openai-api-key-here',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
    rateLimitRpm: 60,
    rateLimitTpm: 90000,
    timeout: 30000
  };

  // Create provider instance
  const provider = new APIProvider('openai-1', 'OpenAI GPT-4', openAIConfig);

  // Test connection
  console.log('Testing connection...');
  const connectionResult = await provider.testConnection();
  if (!connectionResult.success) {
    console.error('Connection failed:', connectionResult.error);
    return;
  }
  console.log('Connection successful! Available models:', connectionResult.availableModels);

  // Prepare a multi-agent conversation request
  const request: LLMRequest = {
    providerId: 'openai-1',
    messages: [
      {
        role: 'system',
        content: 'You are participating in a multi-agent conversation with other AI models.'
      },
      {
        role: 'user',
        content: 'What are the benefits of renewable energy?'
      }
    ],
    systemPrompt: 'You are a helpful assistant in a multi-agent chat. Other participants include Claude and Llama.',
    temperature: 0.7,
    maxTokens: 1000,
    metadata: {
      conversationId: 'conv-123',
      messageId: 'msg-456',
      participantContext: ['gpt-4', 'claude-3', 'llama2']
    }
  };

  try {
    // Send regular request
    console.log('Sending request...');
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
 * Example: Creating and using an Anthropic provider
 */
async function anthropicExample() {
  const anthropicConfig: APIProviderConfig = {
    displayName: 'Claude 3 Sonnet',
    apiKey: 'sk-ant-your-anthropic-api-key-here',
    baseUrl: 'https://api.anthropic.com/v1',
    modelName: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    temperature: 0.7,
    headers: {
      'anthropic-version': '2023-06-01'
    },
    timeout: 30000
  };

  const provider = new APIProvider('anthropic-1', 'Claude 3 Sonnet', anthropicConfig);

  // Validate configuration
  const validation = await provider.validateConfig();
  if (!validation.isValid) {
    console.error('Configuration errors:', validation.errors);
    return;
  }

  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:', validation.warnings);
  }

  // Perform health check
  const health = await provider.healthCheck();
  console.log('Health check:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
  if (health.error) {
    console.error('Health check error:', health.error);
  }
}

/**
 * Example: Error handling
 */
async function errorHandlingExample() {
  // Provider with invalid API key
  const invalidConfig: APIProviderConfig = {
    displayName: 'Invalid Provider',
    apiKey: 'invalid-key',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4'
  };

  const provider = new APIProvider('invalid', 'Invalid Provider', invalidConfig);

  const request: LLMRequest = {
    providerId: 'invalid',
    messages: [{ role: 'user', content: 'Hello' }]
  };

  try {
    await provider.sendRequest(request);
  } catch (error: any) {
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    console.log('Provider ID:', error.providerId);
    console.log('Error code:', error.code);
    console.log('Status code:', error.statusCode);
    console.log('Retryable:', error.retryable);
  }
}

/**
 * Example: Rate limiting
 */
async function rateLimitingExample() {
  const rateLimitedConfig: APIProviderConfig = {
    displayName: 'Rate Limited Provider',
    apiKey: 'sk-your-api-key-here',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-3.5-turbo',
    rateLimitRpm: 3, // Very low limit for demonstration
    rateLimitTpm: 1000
  };

  const provider = new APIProvider('rate-limited', 'Rate Limited', rateLimitedConfig);

  const request: LLMRequest = {
    providerId: 'rate-limited',
    messages: [{ role: 'user', content: 'Hello' }]
  };

  // Send multiple requests quickly to trigger rate limiting
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`Sending request ${i + 1}...`);
      const response = await provider.sendRequest(request);
      console.log(`Request ${i + 1} successful:`, response.content.substring(0, 50));
    } catch (error: any) {
      if (error.name === 'RateLimitError') {
        console.log(`Request ${i + 1} rate limited. Retry after:`, error.retryAfter, 'seconds');
      } else {
        console.error(`Request ${i + 1} failed:`, error.message);
      }
    }
  }
}

// Export examples for use in other files
export {
  openAIExample,
  anthropicExample,
  errorHandlingExample,
  rateLimitingExample
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('=== API Provider Examples ===\n');
  
  // Uncomment the examples you want to run:
  // openAIExample();
  // anthropicExample();
  // errorHandlingExample();
  // rateLimitingExample();
  
  console.log('Examples are commented out. Uncomment them to run with real API keys.');
}