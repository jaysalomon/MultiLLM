/**
 * LM Studio Provider Usage Examples
 * Requirements: 4.3, 4.4, 2.4
 */

import { LMStudioProvider } from '../LMStudioProvider';
import type { LMStudioProviderConfig, LLMRequest } from '../../../types';

/**
 * Basic LM Studio provider setup and usage
 */
async function basicUsageExample() {
  console.log('=== Basic LM Studio Provider Usage ===');
  
  // Configure the provider
  const config: LMStudioProviderConfig = {
    displayName: 'LM Studio Llama 2',
    host: 'http://localhost:1234',
    modelName: 'llama-2-7b-chat',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 30000
  };

  // Create provider instance
  const provider = new LMStudioProvider('lmstudio-1', 'LM Studio Llama 2', config);

  try {
    // Test connection first
    console.log('Testing connection...');
    const connectionResult = await provider.testConnection();
    
    if (!connectionResult.success) {
      console.error('Connection failed:', connectionResult.error);
      return;
    }
    
    console.log('✓ Connected successfully');
    console.log('Available models:', connectionResult.availableModels);
    console.log('Latency:', connectionResult.latency, 'ms');

    // Send a basic request
    const request: LLMRequest = {
      providerId: 'lmstudio-1',
      messages: [
        { role: 'user', content: 'Hello! Can you tell me about yourself?' }
      ]
    };

    console.log('\nSending request...');
    const response = await provider.sendRequest(request);
    
    console.log('Response:', response.content);
    console.log('Processing time:', response.metadata.processingTime, 'ms');
    console.log('Token count:', response.metadata.tokenCount);

  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Streaming response example
 */
async function streamingExample() {
  console.log('\n=== Streaming Response Example ===');
  
  const config: LMStudioProviderConfig = {
    displayName: 'LM Studio Streaming',
    host: 'http://localhost:1234',
    modelName: 'llama-2-7b-chat',
    maxTokens: 1000,
    temperature: 0.8
  };

  const provider = new LMStudioProvider('lmstudio-stream', 'LM Studio Streaming', config);

  const request: LLMRequest = {
    providerId: 'lmstudio-stream',
    messages: [
      { role: 'user', content: 'Write a short story about a robot learning to paint.' }
    ]
  };

  console.log('Starting streaming request...');
  
  let fullResponse = '';
  
  await provider.sendStreamingRequest(
    request,
    (chunk) => {
      process.stdout.write(chunk);
      fullResponse += chunk;
    },
    (response) => {
      console.log('\n\n✓ Streaming complete');
      console.log('Total processing time:', response.metadata.processingTime, 'ms');
      console.log('Full response length:', fullResponse.length, 'characters');
    },
    (error) => {
      console.error('\n✗ Streaming error:', error.message);
    }
  );
}

/**
 * Multi-agent conversation example
 */
async function multiAgentExample() {
  console.log('\n=== Multi-Agent Conversation Example ===');
  
  const config: LMStudioProviderConfig = {
    displayName: 'LM Studio Multi-Agent',
    host: 'http://localhost:1234',
    modelName: 'llama-2-7b-chat',
    maxTokens: 1500,
    temperature: 0.7
  };

  const provider = new LMStudioProvider('lmstudio-multi', 'LM Studio Multi-Agent', config);

  // Simulate a multi-agent conversation
  const request: LLMRequest = {
    providerId: 'lmstudio-multi',
    messages: [
      {
        role: 'system',
        content: 'You are participating in a multi-agent conversation about renewable energy. Other participants include GPT-4 and Claude. Be collaborative and acknowledge their contributions.'
      },
      { role: 'user', content: 'What are the main challenges facing solar energy adoption?' },
      {
        role: 'assistant',
        content: 'The main challenges include high initial costs, intermittency issues, and storage limitations.',
        name: 'gpt-4'
      },
      {
        role: 'assistant',
        content: 'I agree with GPT-4. Additionally, we should consider grid integration challenges and policy barriers.',
        name: 'claude-3'
      }
    ],
    metadata: {
      conversationId: 'conv-renewable-energy',
      messageId: 'msg-123',
      participantContext: ['gpt-4', 'claude-3', 'lmstudio-llama2']
    }
  };

  try {
    console.log('Sending multi-agent request...');
    const response = await provider.sendRequest(request);
    
    console.log('LM Studio response:');
    console.log(response.content);
    
  } catch (error) {
    console.error('Multi-agent request failed:', error);
  }
}

/**
 * Configuration validation example
 */
async function configValidationExample() {
  console.log('\n=== Configuration Validation Example ===');
  
  // Test with invalid configuration
  const invalidConfig: LMStudioProviderConfig = {
    displayName: '',
    host: 'invalid-url',
    modelName: '',
    temperature: 3.0, // Invalid temperature
    maxTokens: -100   // Invalid max tokens
  };

  const provider = new LMStudioProvider('lmstudio-invalid', 'Invalid Config', invalidConfig);

  const validation = await provider.validateConfig();
  
  console.log('Configuration valid:', validation.isValid);
  
  if (validation.errors.length > 0) {
    console.log('Errors:');
    validation.errors.forEach(error => console.log('  -', error));
  }
  
  if (validation.warnings.length > 0) {
    console.log('Warnings:');
    validation.warnings.forEach(warning => console.log('  -', warning));
  }

  // Test with valid configuration
  const validConfig: LMStudioProviderConfig = {
    displayName: 'Valid LM Studio Config',
    host: 'http://localhost:1234',
    modelName: 'llama-2-7b-chat',
    temperature: 0.7,
    maxTokens: 2048
  };

  const validProvider = new LMStudioProvider('lmstudio-valid', 'Valid Config', validConfig);
  const validValidation = await validProvider.validateConfig();
  
  console.log('\nValid configuration:', validValidation.isValid);
}

/**
 * Error handling example
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  // Configure with wrong port to trigger connection error
  const config: LMStudioProviderConfig = {
    displayName: 'LM Studio Wrong Port',
    host: 'http://localhost:9999', // Wrong port
    modelName: 'non-existent-model',
    timeout: 5000 // Short timeout
  };

  const provider = new LMStudioProvider('lmstudio-error', 'Error Test', config);

  try {
    console.log('Testing connection to wrong port...');
    const connectionResult = await provider.testConnection();
    
    if (!connectionResult.success) {
      console.log('Expected connection failure:', connectionResult.error);
    }
    
  } catch (error) {
    console.log('Caught connection error:', error.message);
  }

  // Test with very short timeout
  const timeoutConfig: LMStudioProviderConfig = {
    displayName: 'LM Studio Timeout Test',
    host: 'http://localhost:1234',
    modelName: 'llama-2-7b-chat',
    timeout: 1 // 1ms timeout - will definitely timeout
  };

  const timeoutProvider = new LMStudioProvider('lmstudio-timeout', 'Timeout Test', timeoutConfig);

  try {
    const request: LLMRequest = {
      providerId: 'lmstudio-timeout',
      messages: [{ role: 'user', content: 'This will timeout' }]
    };

    await timeoutProvider.sendRequest(request);
    
  } catch (error) {
    console.log('Expected timeout error:', error.message);
  }
}

/**
 * Health monitoring example
 */
async function healthMonitoringExample() {
  console.log('\n=== Health Monitoring Example ===');
  
  const config: LMStudioProviderConfig = {
    displayName: 'LM Studio Health Monitor',
    host: 'http://localhost:1234',
    modelName: 'llama-2-7b-chat'
  };

  const provider = new LMStudioProvider('lmstudio-health', 'Health Monitor', config);

  try {
    console.log('Performing health check...');
    const health = await provider.healthCheck();
    
    console.log('Health status:', health.healthy ? 'HEALTHY' : 'UNHEALTHY');
    console.log('Latency:', health.latency, 'ms');
    console.log('Last checked:', health.lastChecked);
    
    if (!health.healthy && health.error) {
      console.log('Health error:', health.error);
    }

    // Get cached health result
    const cachedHealth = provider.getLastHealthCheck();
    if (cachedHealth) {
      console.log('Cached health result available from:', cachedHealth.lastChecked);
    }
    
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

/**
 * Model discovery example
 */
async function modelDiscoveryExample() {
  console.log('\n=== Model Discovery Example ===');
  
  const config: LMStudioProviderConfig = {
    displayName: 'LM Studio Model Discovery',
    host: 'http://localhost:1234',
    modelName: 'any-model' // We'll discover available models
  };

  const provider = new LMStudioProvider('lmstudio-discovery', 'Model Discovery', config);

  try {
    console.log('Discovering available models...');
    const models = await provider.getAvailableModels();
    
    console.log('Available models:');
    models.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model}`);
    });
    
    if (models.length === 0) {
      console.log('No models found. Make sure LM Studio is running and has models loaded.');
    }
    
  } catch (error) {
    console.error('Model discovery failed:', error.message);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('LM Studio Provider Examples');
  console.log('===========================');
  
  try {
    await basicUsageExample();
    await streamingExample();
    await multiAgentExample();
    await configValidationExample();
    await errorHandlingExample();
    await healthMonitoringExample();
    await modelDiscoveryExample();
    
    console.log('\n✓ All examples completed');
    
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export examples for individual testing
export {
  basicUsageExample,
  streamingExample,
  multiAgentExample,
  configValidationExample,
  errorHandlingExample,
  healthMonitoringExample,
  modelDiscoveryExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}