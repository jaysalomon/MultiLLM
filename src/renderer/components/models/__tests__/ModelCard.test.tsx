import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelCard } from '../ModelCard';
import { ModelParticipant, ProviderStatus } from '../../../../types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock CSS imports
vi.mock('../ModelCard.css', () => ({}));
vi.mock('../ModelStatusIndicator.css', () => ({}));

const mockParticipant: ModelParticipant = {
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
};

const mockStatus: ProviderStatus = {
  providerId: '1',
  isConnected: true,
  lastChecked: new Date(),
  latency: 150
};

const defaultProps = {
  participant: mockParticipant,
  status: mockStatus,
  onToggle: vi.fn(),
  onEdit: vi.fn(),
  onRemove: vi.fn()
};

describe('ModelCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders participant information correctly', () => {
    render(<ModelCard {...defaultProps} />);
    
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('OpenAI (api)')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays inactive state correctly', () => {
    const inactiveParticipant = { ...mockParticipant, isActive: false };
    render(<ModelCard {...defaultProps} participant={inactiveParticipant} />);
    
    expect(screen.getAllByText('Paused').length).toBe(2);
  });

  it('calls onToggle when toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelCard {...defaultProps} />);
    
    await user.click(screen.getByText('Active'));
    
    expect(defaultProps.onToggle).toHaveBeenCalled();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelCard {...defaultProps} />);
    
    await user.click(screen.getByText('Edit'));
    
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('calls onRemove when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<ModelCard {...defaultProps} />);
    
    await user.click(screen.getByText('Remove'));
    
    expect(defaultProps.onRemove).toHaveBeenCalled();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ModelCard {...defaultProps} />);
    
    const toggleButton = screen.getByText('Active');
    toggleButton.focus();
    
    await user.keyboard('{Enter}');
    expect(defaultProps.onToggle).toHaveBeenCalled();
    
    await user.keyboard(' ');
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(2);
  });

  it('displays drag handle when draggable', () => {
    render(<ModelCard {...defaultProps} draggable={true} />);
    
    expect(screen.getByTitle('Drag to reorder')).toBeInTheDocument();
  });

  it('handles drag events', () => {
    const onDragStart = vi.fn();
    const onDragOver = vi.fn();
    const onDragEnd = vi.fn();
    const onDrop = vi.fn();
    
    render(
      <ModelCard 
        {...defaultProps} 
        draggable={true}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
      />
    );
    
    const card = screen.getByTestId('model-card');
    
    fireEvent.dragStart(card);
    expect(onDragStart).toHaveBeenCalled();
    
    fireEvent.dragOver(card);
    expect(onDragOver).toHaveBeenCalled();
    
    fireEvent.dragEnd(card);
    expect(onDragEnd).toHaveBeenCalled();
    
    fireEvent.drop(card);
    expect(onDrop).toHaveBeenCalled();
  });

  it('applies drag over styling', () => {
    const { container } = render(
      <ModelCard {...defaultProps} isDraggedOver={true} />
    );
    
    expect(container.firstChild).toHaveClass('model-card--drag-over');
  });

  it('applies dragging styling', () => {
    const { container } = render(
      <ModelCard {...defaultProps} isDragging={true} />
    );
    
    expect(container.firstChild).toHaveClass('model-card--dragging');
  });

  it('displays avatar with first letter when no avatar provided', () => {
    render(<ModelCard {...defaultProps} />);
    
    const avatar = screen.getByText('G'); // First letter of GPT-4
    expect(avatar).toBeInTheDocument();
  });

  it('displays error status correctly', () => {
    const errorStatus: ProviderStatus = {
      providerId: '1',
      isConnected: false,
      lastChecked: new Date(),
      error: 'Connection failed'
    };
    
    render(<ModelCard {...defaultProps} status={errorStatus} />);
    
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('displays unknown status when no status provided', () => {
    render(<ModelCard {...defaultProps} status={undefined} />);
    
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('applies correct CSS classes for active/inactive states', () => {
    const { container, rerender } = render(<ModelCard {...defaultProps} />);
    
    expect(container.firstChild).toHaveClass('model-card--active');
    
    const inactiveParticipant = { ...mockParticipant, isActive: false };
    rerender(<ModelCard {...defaultProps} participant={inactiveParticipant} />);
    
    expect(container.firstChild).toHaveClass('model-card--inactive');
  });
});