import { describe, it, expect, afterEach, vi } from 'vitest';
import { LLMOrchestrator } from '../LLMOrchestrator';
import type { ChatMessage, LLMRequest, LLMResponse, ModelParticipant } from '../../types';
import { ProviderType, type ProviderConfig } from '../../types/providers';
import type { ILLMProvider } from '../../providers/base/ILLMProvider';
import { toolExecutor } from '../../tools/ToolExecutor';

class MockProvider {
	public id = 'mock-model';
	public name = 'Mock Provider';
	public type = 'api';
	public config: ProviderConfig = {
		displayName: 'Mock Provider',
		modelName: 'mock-model',
		apiKey: 'test',
		baseUrl: 'https://example.com'
	} as any;

	private callCount = 0;
	public capturedRequests: LLMRequest[] = [];

	async sendRequest(request: LLMRequest): Promise<LLMResponse> {
		this.capturedRequests.push(request);

		if (this.callCount === 0) {
			this.callCount += 1;
			return {
				modelId: this.id,
				content: null,
				tool_calls: [
					{
						id: 'call_1',
						type: 'function',
						function: {
							name: 'calculator',
							arguments: JSON.stringify({ expression: '1+2' })
						}
					}
				],
				metadata: {
					processingTime: 10,
					finishReason: 'tool_calls'
				}
			};
		}

		return {
			modelId: this.id,
			content: 'The answer is 3',
			metadata: {
				processingTime: 8,
				finishReason: 'stop'
			}
		};
	}

	async sendStreamingRequest(): Promise<void> {
		return Promise.resolve();
	}

	async getAvailableModels(): Promise<string[]> {
		return ['mock-model'];
	}

	async testConnection(): Promise<any> {
		return { success: true, latency: 1 };
	}

	async validateConfig(): Promise<any> {
		return { isValid: true, errors: [], warnings: [] };
	}

	async healthCheck(): Promise<any> {
		return { healthy: true, latency: 1, lastChecked: new Date() };
	}
}

describe('LLMOrchestrator tool calling', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('executes function tool calls and returns enriched response', async () => {
		const participant: ModelParticipant = {
			id: 'mock-model',
			provider: {
			id: 'mock-model',
			name: 'Mock Provider',
			type: ProviderType.Api,
				config: {
					displayName: 'Mock Provider',
					modelName: 'mock-model',
					apiKey: 'test',
					baseUrl: 'https://example.com'
				} as any,
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date()
			},
			modelName: 'mock-model',
			displayName: 'Mock Model',
			color: '#000000',
			isActive: true,
			addedAt: new Date()
		};

			const provider = new MockProvider() as unknown as ILLMProvider;

			const orchestrator = new LLMOrchestrator([
				participant
			], [provider], {
			requestTimeout: 5000,
			toolCallMaxIterations: 3
		});

		orchestrator.setAvailableTools(['calculator']);

		const toolSpy = vi
			.spyOn(toolExecutor, 'execute')
			.mockImplementation(async () => '3');

		const messages: ChatMessage[] = [
			{
				id: 'msg_1',
				sender: 'user',
				content: 'What is 1 + 2?',
				timestamp: new Date()
			}
		];

		const response = await orchestrator.sendToAllModels(messages, 'conversation-1', 'message-1');

		expect(toolSpy).toHaveBeenCalledTimes(1);
		expect(response.responses).toHaveLength(1);

		const modelResponse = response.responses[0];
		expect(modelResponse.content).toBe('The answer is 3');
		expect(modelResponse.toolResults).toBeDefined();
		expect(modelResponse.toolResults?.[0].output).toBe('3');
		expect(modelResponse.toolResults?.[0].name).toBe('calculator');
	});
});
