
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelSidebar } from '../ModelSidebar';
import { ModelParticipant, LLMProvider, ProviderStatus, ProviderType } from '../../../../types';
import userEvent from '@testing-library/user-event';

// Mock CSS imports
vi.mock('../ModelSidebar.css', () => ({}));
vi.mock('../ModelCard.css', () => ({}));
vi.mock('../ModelStatusIndicator.css', () => ({}));
vi.mock('../AddModelButton.css', () => ({}));
vi.mock('../ModelConfigModal.css', () => ({}));

// Mock electronAPI
vi.stubGlobal('window', {
  electronAPI: {
    getBudgetStatus: vi.fn().mockResolvedValue({ budget: 100, spending: 50, remaining: 50 }),
    openPerformanceDashboard: vi.fn(),
  },
});

const mockParticipants: ModelParticipant[] = [
  {
    id: '1',
    displayName: 'Model 1',
    isActive: true,
    provider: { id: 'p1', name: 'Provider 1', type: ProviderType.Ollama, config: {} },
    color: '#ff0000',
  },
  {
    id: '2',
    displayName: 'Model 2',
    isActive: false,
    provider: { id: 'p2', name: 'Provider 2', type: ProviderType.Ollama, config: {} },
    color: '#00ff00',
  },
  {
    id: '3',
    displayName: 'Model 3',
    isActive: true,
    provider: { id: 'p3', name: 'Provider 3', type: ProviderType.Ollama, config: {} },
    color: '#0000ff',
  },
];

const mockProviderStatuses = new Map<string, ProviderStatus>([
  ['1', {
    providerId: '1',
    isConnected: true,
    lastChecked: new Date(),
    latency: 150
  }],
  ['2', {
    providerId: '2',
    isConnected: false,
    lastChecked: new Date(),
    error: 'Connection timeout'
  }],
  ['3', {
    providerId: '3',
    isConnected: false,
    lastChecked: new Date(),
    error: 'Some error'
  }]
]);

const defaultProps = {
  participants: mockParticipants,
  providerStatuses: mockProviderStatuses,
  onAddModel: vi.fn(),
  onRemoveModel: vi.fn(),
  onToggleModel: vi.fn(),
  onUpdateModel: vi.fn(),
  onReorderModels: vi.fn(),
};

describe('ModelSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with participants', () => {
    render(<ModelSidebar {...defaultProps} />);
    
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Add Model')).toBeInTheDocument();
    expect(screen.getByText('Active Models (2)')).toBeInTheDocument();
    expect(screen.getByText('Inactive Models (1)')).toBeInTheDocument();
    expect(screen.getByText('Model 1')).toBeInTheDocument();
    expect(screen.getByText('Model 2')).toBeInTheDocument();
    expect(screen.getByText('Model 3')).toBeInTheDocument();
  });

  it('renders collapsed state correctly', () => {
    render(<ModelSidebar {...defaultProps} isCollapsed={true} />);
    
    expect(screen.queryByText('Models')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Model')).not.toBeInTheDocument();
    expect(screen.getByTitle('Expand model sidebar')).toBeInTheDocument();
  });

  it('shows empty state when no participants', () => {
    render(<ModelSidebar {...defaultProps} participants={[]} />);
    
    expect(screen.getByText('No models configured yet. Add your first model to get started!')).toBeInTheDocument();
  });

  it('calls onAddModel when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...defaultProps} />);
    
    await user.click(screen.getByText('Add Model'));
    
    // Modal should open
    expect(screen.getByTestId('model-config-modal')).toBeInTheDocument();
  });

  it('calls onToggleModel when model toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...defaultProps} />);
    
    const toggleButton = screen.getAllByTitle('Toggle model activation')[0];
    await user.click(toggleButton);
    
    expect(defaultProps.onToggleModel).toHaveBeenCalledWith('1');
  });

  it('calls onRemoveModel when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelSidebar {...defaultProps} />);
    
    const removeButtons = screen.getAllByTitle('Remove model');
    await user.click(removeButtons[0]);
    
    expect(defaultProps.onRemoveModel).toHaveBeenCalledWith('1');
  });

  it('calls onToggleCollapse when toggle button is clicked', async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    
    render(<ModelSidebar {...defaultProps} onToggleCollapse={onToggleCollapse} />);
    
    const toggleButton = screen.getByTitle('Collapse model sidebar');
    await user.click(toggleButton);
    
    expect(onToggleCollapse).toHaveBeenCalled();
  });

  it('displays correct status indicators', () => {
    render(<ModelSidebar {...defaultProps} />);
    
    expect(screen.getByTitle('Connected (150ms)')).toBeInTheDocument();
    expect(screen.getByTitle('Error: Connection timeout')).toBeInTheDocument();
  });

  it('filters active and inactive models correctly', () => {
    render(<ModelSidebar {...defaultProps} />);
    
    expect(screen.getByText('Active Models (2)')).toBeInTheDocument();
    expect(screen.getByText('Inactive Models (1)')).toBeInTheDocument();
  });
});
