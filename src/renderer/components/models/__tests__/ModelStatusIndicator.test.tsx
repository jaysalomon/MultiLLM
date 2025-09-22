import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ModelStatusIndicator } from '../ModelStatusIndicator';
import { ProviderStatus } from '../../../../types';

// Mock CSS imports
vi.mock('../ModelStatusIndicator.css', () => ({}));

describe('ModelStatusIndicator', () => {
  it('displays paused status when model is inactive', () => {
    render(<ModelStatusIndicator isActive={false} />);
    
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByTitle('Model is paused')).toBeInTheDocument();
  });

  it('displays unknown status when no status provided and model is active', () => {
    render(<ModelStatusIndicator isActive={true} />);
    
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByTitle('Status unknown')).toBeInTheDocument();
  });

  it('displays error status when status has error', () => {
    const errorStatus: ProviderStatus = {
      providerId: '1',
      isConnected: false,
      lastChecked: new Date(),
      error: 'Connection failed'
    };
    
    render(<ModelStatusIndicator status={errorStatus} isActive={true} />);
    
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByTitle('Error: Connection failed')).toBeInTheDocument();
  });

  it('displays disconnected status when not connected', () => {
    const disconnectedStatus: ProviderStatus = {
      providerId: '1',
      isConnected: false,
      lastChecked: new Date()
    };
    
    render(<ModelStatusIndicator status={disconnectedStatus} isActive={true} />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByTitle('Not connected to provider')).toBeInTheDocument();
  });

  it('displays connected status when connected', () => {
    const connectedStatus: ProviderStatus = {
      providerId: '1',
      isConnected: true,
      lastChecked: new Date(),
      latency: 150
    };
    
    render(<ModelStatusIndicator status={connectedStatus} isActive={true} />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByTitle('Connected (150ms)')).toBeInTheDocument();
  });

  it('displays connected status without latency when latency is unknown', () => {
    const connectedStatus: ProviderStatus = {
      providerId: '1',
      isConnected: true,
      lastChecked: new Date()
    };
    
    render(<ModelStatusIndicator status={connectedStatus} isActive={true} />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByTitle('Connected (latency unknown)')).toBeInTheDocument();
  });

  it('applies correct size classes', () => {
    const { container, rerender } = render(
      <ModelStatusIndicator isActive={true} size="small" />
    );
    
    expect(container.firstChild).toHaveClass('model-status-indicator--small');
    
    rerender(<ModelStatusIndicator isActive={true} size="large" />);
    expect(container.firstChild).toHaveClass('model-status-indicator--large');
  });

  it('hides text when showText is false', () => {
    render(<ModelStatusIndicator isActive={true} showText={false} />);
    
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('applies correct status type classes', () => {
    const { container, rerender } = render(
      <ModelStatusIndicator isActive={false} />
    );
    
    expect(container.firstChild).toHaveClass('model-status-indicator--paused');
    
    const errorStatus: ProviderStatus = {
      providerId: '1',
      isConnected: false,
      lastChecked: new Date(),
      error: 'Connection failed'
    };
    
    rerender(<ModelStatusIndicator status={errorStatus} isActive={true} />);
    expect(container.firstChild).toHaveClass('model-status-indicator--error');
    
    const connectedStatus: ProviderStatus = {
      providerId: '1',
      isConnected: true,
      lastChecked: new Date()
    };
    
    rerender(<ModelStatusIndicator status={connectedStatus} isActive={true} />);
    expect(container.firstChild).toHaveClass('model-status-indicator--connected');
  });

  it('displays correct icons for each status', () => {
    const { rerender } = render(<ModelStatusIndicator isActive={false} />);
    expect(screen.getByText('⏸️')).toBeInTheDocument();
    
    rerender(<ModelStatusIndicator isActive={true} />);
    expect(screen.getByText('❓')).toBeInTheDocument();
    
    const errorStatus: ProviderStatus = {
      providerId: '1',
      isConnected: false,
      lastChecked: new Date(),
      error: 'Connection failed'
    };
    
    rerender(<ModelStatusIndicator status={errorStatus} isActive={true} />);
    expect(screen.getByText('❌')).toBeInTheDocument();
    
    const disconnectedStatus: ProviderStatus = {
      providerId: '1',
      isConnected: false,
      lastChecked: new Date()
    };
    
    rerender(<ModelStatusIndicator status={disconnectedStatus} isActive={true} />);
    expect(screen.getByText('🔌')).toBeInTheDocument();
    
    const connectedStatus: ProviderStatus = {
      providerId: '1',
      isConnected: true,
      lastChecked: new Date()
    };
    
    rerender(<ModelStatusIndicator status={connectedStatus} isActive={true} />);
    expect(screen.getByText('✅')).toBeInTheDocument();
  });
});