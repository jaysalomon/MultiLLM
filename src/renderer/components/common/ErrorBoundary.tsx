import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../../utils/Logger';
import { errorReporter, addBreadcrumb } from '../../../utils/ErrorReporter';
import { performanceMonitor } from '../../../utils/PerformanceMonitor';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  component?: string;
  enableRetry?: boolean;
  enableReporting?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

/**
 * Enhanced error boundary component with comprehensive logging and reporting
 * Requirements: 2.4, 4.5
 */
export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Add breadcrumb for error context
    addBreadcrumb({
      category: 'error',
      message: `Error boundary caught error in ${this.props.component || 'unknown component'}`,
      level: 'error',
      data: {
        error: error.message,
        componentStack: errorInfo.componentStack
      }
    });

    // Log error with comprehensive context
    logger.ui(
      'ERROR',
      `Error boundary caught error: ${error.message}`,
      {
        component: this.props.component,
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
        props: this.props
      },
      error
    );

    // Report error if enabled
    if (this.props.enableReporting !== false) {
      errorReporter.reportError(error, {
        component: this.props.component || 'ErrorBoundary',
        action: 'component_render',
        additionalData: {
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount
        }
      });
    }

    // Record performance impact
    performanceMonitor.recordMetric({
      name: 'error_boundary_triggered',
      value: 1,
      unit: 'count',
      category: 'error',
      tags: {
        component: this.props.component || 'unknown',
        retryCount: this.state.retryCount.toString()
      }
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      logger.info(`Retrying component render (attempt ${this.state.retryCount + 1}/${this.maxRetries})`, {
        component: this.props.component
      });

      addBreadcrumb({
        category: 'user_action',
        message: `User retried error boundary (attempt ${this.state.retryCount + 1})`,
        level: 'info',
        data: {
          component: this.props.component,
          retryCount: this.state.retryCount + 1
        }
      });

      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: this.state.retryCount + 1
      });
    }
  };

  handleReportIssue = () => {
    addBreadcrumb({
      category: 'user_action',
      message: 'User reported issue from error boundary',
      level: 'info',
      data: {
        component: this.props.component,
        error: this.state.error?.message
      }
    });

    // In a real app, this would open a feedback form or send to support
    logger.info('User reported issue from error boundary', {
      component: this.props.component,
      error: this.state.error?.message,
      errorStack: this.state.error?.stack
    });

    alert('Thank you for reporting this issue. Our team has been notified.');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.props.enableRetry !== false && this.state.retryCount < this.maxRetries;

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>
              An unexpected error occurred in {this.props.component || 'this component'}.
              {canRetry && ` You can try again (${this.maxRetries - this.state.retryCount} attempts remaining).`}
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="error-actions">
              {canRetry && (
                <button 
                  onClick={this.handleRetry}
                  className="error-button primary"
                >
                  Try Again ({this.maxRetries - this.state.retryCount} left)
                </button>
              )}
              <button 
                onClick={() => window.location.reload()}
                className="error-button secondary"
              >
                Refresh Page
              </button>
              <button 
                onClick={this.handleReportIssue}
                className="error-button tertiary"
              >
                Report Issue
              </button>
            </div>
            
            {this.state.retryCount > 0 && (
              <div className="error-retry-info">
                <small>Retry attempts: {this.state.retryCount}/{this.maxRetries}</small>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error display component for inline errors
 */
interface ErrorDisplayProps {
  error: string | Error;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'inline' | 'card' | 'banner';
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  title = 'Error',
  onRetry,
  onDismiss,
  variant = 'inline'
}) => {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className={`error-display error-display-${variant}`} role="alert">
      <div className="error-display-content">
        <div className="error-display-header">
          <span className="error-display-icon">⚠️</span>
          <h3 className="error-display-title">{title}</h3>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="error-display-dismiss"
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
        <p className="error-display-message">{errorMessage}</p>
        {onRetry && (
          <div className="error-display-actions">
            <button onClick={onRetry} className="error-button primary">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Empty state component for when there's no data
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = '📭',
  action
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <div className="empty-state-icon">{icon}</div>
        <h3 className="empty-state-title">{title}</h3>
        {description && <p className="empty-state-description">{description}</p>}
        {action && (
          <button onClick={action.onClick} className="empty-state-action">
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
};