import React from 'react';
import { ProviderStatus } from '../../../types';
import './ModelStatusIndicator.css';

export interface ModelStatusIndicatorProps {
  status?: ProviderStatus;
  isActive: boolean;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export const ModelStatusIndicator: React.FC<ModelStatusIndicatorProps> = ({
  status,
  isActive,
  size = 'medium',
  showText = true
}) => {
  const getStatusInfo = () => {
    if (!isActive) {
      return {
        type: 'paused',
        color: '#6c757d',
        icon: '⏸️',
        text: 'Paused',
        title: 'Model is paused'
      };
    }

    if (!status) {
      return {
        type: 'unknown',
        color: '#ffc107',
        icon: '❓',
        text: 'Unknown',
        title: 'Status unknown'
      };
    }

    if (status.error) {
      return {
        type: 'error',
        color: '#dc3545',
        icon: '❌',
        text: 'Error',
        title: `Error: ${status.error}`
      };
    }

    if (!status.isConnected) {
      return {
        type: 'disconnected',
        color: '#fd7e14',
        icon: '🔌',
        text: 'Disconnected',
        title: 'Not connected to provider'
      };
    }

    return {
      type: 'connected',
      color: '#28a745',
      icon: '✅',
      text: 'Connected',
      title: `Connected (${status.latency ? `${status.latency}ms` : 'latency unknown'})`
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div 
      className={`model-status-indicator model-status-indicator--${size} model-status-indicator--${statusInfo.type}`}
      title={statusInfo.title}
    >
      <div 
        className="model-status-indicator__dot"
        style={{ backgroundColor: statusInfo.color }}
      />
      <span className="model-status-indicator__icon">
        {statusInfo.icon}
      </span>
      {showText && (
        <span className="model-status-indicator__text">
          {statusInfo.text}
        </span>
      )}
    </div>
  );
};

export default ModelStatusIndicator;