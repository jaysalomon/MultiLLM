
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AddModelButton } from '../AddModelButton';

// Mock CSS imports
vi.mock('../AddModelButton.css', () => ({}));

describe('AddModelButton', () => {
  const defaultProps = {
    onClick: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<AddModelButton {...defaultProps} />);
    
    expect(screen.getByText('Add Model')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByTitle('Add a new model to the conversation')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    render(<AddModelButton {...defaultProps} />);
    
    await user.click(screen.getByTitle('Add a new model to the conversation'));
    
    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<AddModelButton {...defaultProps} />);
    
    const button = screen.getByTitle('Add a new model to the conversation');
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(defaultProps.onClick).toHaveBeenCalled();
    
    await user.keyboard(' ');
    expect(defaultProps.onClick).toHaveBeenCalledTimes(2);
  });

  it('is disabled when disabled prop is true', () => {
    render(<AddModelButton {...defaultProps} disabled={true} />);
    
    const button = screen.getByTitle('Add a new model to the conversation');
    expect(button).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    render(<AddModelButton {...defaultProps} disabled={true} />);
    
    await user.click(screen.getByTitle('Add a new model to the conversation'));
    
    expect(defaultProps.onClick).not.toHaveBeenCalled();
  });

  it('applies correct size classes', () => {
    const { container, rerender } = render(
      <AddModelButton {...defaultProps} size="small" />
    );
    
    expect(container.firstChild).toHaveClass('add-model-button--small');
    
    rerender(<AddModelButton {...defaultProps} size="large" />);
    expect(container.firstChild).toHaveClass('add-model-button--large');
  });

  it('applies correct variant classes', () => {
    const { container, rerender } = render(
      <AddModelButton {...defaultProps} variant="secondary" />
    );
    
    expect(container.firstChild).toHaveClass('add-model-button--secondary');
    
    rerender(<AddModelButton {...defaultProps} variant="outline" />);
    expect(container.firstChild).toHaveClass('add-model-button--outline');
  });

  it('has correct accessibility attributes', () => {
    render(<AddModelButton {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Add a new model to the conversation');
  });

  it('prevents keyboard action when disabled', async () => {
    const user = userEvent.setup();
    render(<AddModelButton {...defaultProps} disabled={true} />);
    
    const button = screen.getByTitle('Add a new model to the conversation');
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(defaultProps.onClick).not.toHaveBeenCalled();
    
    await user.keyboard(' ');
    expect(defaultProps.onClick).not.toHaveBeenCalled();
  });
});
