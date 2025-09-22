import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelConfigModal } from '../ModelConfigModal';
import { LLMProvider } from '../../../../types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock CSS imports
vi.mock('../ModelConfigModal.css', () => ({}));

const mockProvider: LLMProvider = {
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
};

const defaultProps = {
  onSave: vi.fn(),
  onCancel: vi.fn()
};

describe('ModelConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add modal correctly', () => {
    render(<ModelConfigModal {...defaultProps} />);
    
    expect(screen.getByText('Add New Model')).toBeInTheDocument();
    expect(screen.getByText('Add Model')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama')).toBeInTheDocument();
  });

  it('renders edit modal correctly', () => {
    render(<ModelConfigModal {...defaultProps} provider={mockProvider} />);
    
    expect(screen.getByText('Edit Model')).toBeInTheDocument();
    expect(screen.getByText('Update Model')).toBeInTheDocument();
    expect(screen.getByDisplayValue('OpenAI')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GPT-4')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.click(screen.getByText('×'));
    
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.click(screen.getByTestId('modal-overlay'));
    
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('handles escape key to close modal', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.keyboard('{Escape}');
    
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.click(screen.getByText('Add Model'));
    
    await waitFor(() => {
        expect(screen.getByText('Name and display name are required')).toBeInTheDocument();
    });
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('validates API provider fields', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.type(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama'), 'OpenAI');
    await user.type(screen.getByPlaceholderText('e.g., GPT-4, Claude 3.5, Llama 3.1'), 'GPT-4');
    
    // Clear base URL to trigger validation
    const baseUrlInput = screen.getByPlaceholderText('https://api.openai.com/v1');
    await user.clear(baseUrlInput);
    
    await user.click(screen.getByText('Add Model'));
    
    await waitFor(() => {
      expect(screen.getByText('Base URL and model name are required for API providers')).toBeInTheDocument();
    });
  });

  it('validates Ollama provider fields', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.type(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama'), 'Ollama');
    await user.type(screen.getByPlaceholderText('e.g., GPT-4, Claude 3.5, Llama 3.1'), 'Llama 3.1');
    await user.selectOptions(screen.getByDisplayValue('API (OpenAI, Anthropic, etc.)'), 'ollama');
    
    // Clear host to trigger validation
    const hostInput = screen.getByPlaceholderText('http://localhost:11434');
    await user.clear(hostInput);
    
    await user.click(screen.getByText('Add Model'));
    
    await waitFor(() => {
      expect(screen.getByText('Host and model name are required for Ollama providers')).toBeInTheDocument();
    });
  });

  it('validates LM Studio provider fields', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.type(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama'), 'LM Studio');
    await user.type(screen.getByPlaceholderText('e.g., GPT-4, Claude 3.5, Llama 3.1'), 'Local Model');
    await user.selectOptions(screen.getByDisplayValue('API (OpenAI, Anthropic, etc.)'), 'lmstudio');
    
    // Clear host to trigger validation
    const hostInput = screen.getByPlaceholderText('http://localhost:1234');
    await user.clear(hostInput);
    
    await user.click(screen.getByText('Add Model'));
    
    await waitFor(() => {
      expect(screen.getByText('Host and model name are required for LM Studio providers')).toBeInTheDocument();
    });
  });

  it('calls onSave with correct data for new provider', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.type(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama'), 'OpenAI');
    await user.type(screen.getByPlaceholderText('e.g., GPT-4, Claude 3.5, Llama 3.1'), 'GPT-4');
    await user.type(screen.getByPlaceholderText('Enter your API key'), 'test-api-key');
    await user.type(screen.getByPlaceholderText('e.g., gpt-4, claude-3-sonnet-20240229, llama3.1'), 'gpt-4');
    
    await user.click(screen.getByText('Add Model'));
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OpenAI',
          type: 'api',
          config: expect.objectContaining({
            displayName: 'GPT-4',
            apiKey: 'test-api-key',
            modelName: 'gpt-4'
          })
        })
      );
    });
  });

  it('updates config when provider type changes', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.selectOptions(screen.getByDisplayValue('API (OpenAI, Anthropic, etc.)'), 'ollama');
    
    expect(screen.getByPlaceholderText('http://localhost:11434')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter your API key')).not.toBeInTheDocument();
  });

  it('focuses first input on mount', async () => {
    render(<ModelConfigModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama')).toHaveFocus();
    });
  });

  it('shows validation state during submission', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    await user.type(screen.getByPlaceholderText('e.g., OpenAI, Anthropic, Local Ollama'), 'OpenAI');
    await user.type(screen.getByPlaceholderText('e.g., GPT-4, Claude 3.5, Llama 3.1'), 'GPT-4');
    await user.type(screen.getByPlaceholderText('e.g., gpt-4, claude-3-sonnet-20240229, llama3.1'), 'gpt-4');
    
    const submitButton = screen.getByText('Add Model');
    await user.click(submitButton);
    
    await waitFor(() => {
        expect(screen.getByText('Validating...')).toBeInTheDocument();
    });
  });

  it('handles advanced settings correctly', async () => {
    const user = userEvent.setup();
    render(<ModelConfigModal {...defaultProps} />);
    
    const temperatureInput = screen.getByDisplayValue('0.7');
    const maxTokensInput = screen.getByDisplayValue('4000');
    
    await user.clear(temperatureInput);
    await user.type(temperatureInput, '0.9');
    
    await user.clear(maxTokensInput);
    await user.type(maxTokensInput, '2000');
    
    expect(temperatureInput).toHaveValue(0.9);
    expect(maxTokensInput).toHaveValue(2000);
  });
});