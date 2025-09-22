
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelSidebar } from '../ModelSidebar';
import { ModelParticipant, ProviderStatus, LLMProvider } from '../../../../types';

// Mock CSS imports
vi.mock('../ModelSidebar.css', () => ({}));
vi.mock('../ModelCard.css', () => ({}));
vi.mock('../ModelStatusIndicator.css', () => ({}));
vi.mock('../AddModelButton.css', () => ({}));
vi.mock('../ModelConfigModal.css', () => ({}));

const mockParticipants: ModelParticipant[] = [
  {
    id: '1',
    provider: {
      id: '1',
      name: 'OpenAI',
      type: 'api',
      config: {
        displayName: 'GPT-4',
        apiKey: 'test-key',
        baseUrl: 'https://api.openai.com/v1',
        modelName: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4000
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    modelName: 'gpt-4',
    displayName: 'GPT-4',
    color: '#3498db',
    isActive: true,
    addedAt: new Date()
  }
];

const mockProviderStatuses = new Map<string, ProviderStatus>([
  ['1', {
    providerId: '1',
    isConnected: true,
    lastChecked: new Date(),
    latency: 150
  }]
]);

describe('Model Management Integration', () => {
  let mockProps: any;

  beforeEach(() => {
    mockProps = {
      participants: mockParticipants,
      providerStatuses: mockProviderStatuses,
      onAddModel: vi.fn(),
      onRemoveModel: vi.fn(),
      onToggleModel: vi.fn(),
      onUpdateModel: vi.fn(),
      onReorderModels: vi.fn()
    };
  });

  it('completes full add model workflow', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...mockProps} />);
    
    // Click add model button
    await user.click(screen.getByTitle('Add a new model to the conversation'));
    
    // Modal should open
    expect(screen.getByText('Add New Model')).toBeInTheDocument();
    
    // Fill out form
    await user.type(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama'), 'Anthropic');
    await user.type(screen.getByPlaceholderText('e.g., GPT-4, Claude 3.5, Llama 3.1'), 'Claude 3');
    await user.type(screen.getByPlaceholderText('Enter your API key'), 'test-anthropic-key');
    await user.clear(screen.getByPlaceholderText('https://api.openai.com/v1'));
    await user.type(screen.getByPlaceholderText('https://api.openai.com/v1'), 'https://api.anthropic.com/v1');
    await user.type(screen.getByPlaceholderText('e.g., gpt-4, claude-3-sonnet-20240229, llama3.1'), 'claude-3-sonnet-20240229');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: 'Add Model' }));
    
    // Should call onAddModel with correct data
    await waitFor(() => {
      expect(mockProps.onAddModel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Anthropic',
          type: 'api',
          config: expect.objectContaining({
            displayName: 'Claude 3',
            apiKey: 'test-anthropic-key',
            baseUrl: 'https://api.anthropic.com/v1',
            modelName: 'claude-3-sonnet-20240229'
          })
        })
      );
    });
  });

  it('handles model toggle workflow', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...mockProps} />);
    
    // Click toggle button
    await user.click(screen.getByText('Active'));
    
    // Should call onToggleModel
    expect(mockProps.onToggleModel).toHaveBeenCalledWith('1');
  });

  it('handles model removal workflow', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...mockProps} />);
    
    // Click remove button
    await user.click(screen.getByText('Remove'));
    
    // Should call onRemoveModel
    expect(mockProps.onRemoveModel).toHaveBeenCalledWith('1');
  });

  it('handles modal cancellation', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...mockProps} />);
    
    // Open add modal
    await user.click(screen.getByTitle('Add a new model to the conversation'));
    expect(screen.getByText('Add New Model')).toBeInTheDocument();
    
    // Cancel modal
    await user.click(screen.getByText('Cancel'));
    
    // Modal should close
    expect(screen.queryByText('Add New Model')).not.toBeInTheDocument();
  });
});
