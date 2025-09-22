import React from 'react';
import './LoadingStates.css';

interface SkeletonLoaderProps {
  lines?: number;
  showAvatar?: boolean;
  showTitle?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 3,
  showAvatar = false,
  showTitle = false,
}) => {
  return (
    <div className="skeleton-loader animate-fade-in">
      {showAvatar && (
        <div className="skeleton-header">
          <div className="skeleton skeleton-avatar" />
          <div className="skeleton-header-text">
            <div className="skeleton skeleton-name" style={{ width: '120px' }} />
            <div className="skeleton skeleton-subtitle" style={{ width: '80px' }} />
          </div>
        </div>
      )}
      {showTitle && <div className="skeleton skeleton-title" />}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
};

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  color,
  text,
}) => {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div
        className="spinner"
        style={color ? { borderTopColor: color } : undefined}
      />
      {text && <span className="spinner-text">{text}</span>}
    </div>
  );
};

interface WaveLoaderProps {
  color?: string;
  text?: string;
}

export const WaveLoader: React.FC<WaveLoaderProps> = ({ color, text }) => {
  return (
    <div className="wave-loader-container">
      <div className="wave-loader">
        <span style={color ? { backgroundColor: color } : undefined} />
        <span style={color ? { backgroundColor: color } : undefined} />
        <span style={color ? { backgroundColor: color } : undefined} />
      </div>
      {text && <span className="wave-loader-text">{text}</span>}
    </div>
  );
};

interface ProgressBarProps {
  progress: number;
  showPercentage?: boolean;
  color?: string;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = false,
  color,
  animated = true,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${animated ? 'animated' : ''}`}
          style={{
            width: `${clampedProgress}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showPercentage && (
        <span className="progress-percentage">{Math.round(clampedProgress)}%</span>
      )}
    </div>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  fullScreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  text = 'Loading...',
  fullScreen = false,
}) => {
  if (!isLoading) return null;

  return (
    <div className={`loading-overlay ${fullScreen ? 'fullscreen' : ''} animate-fade-in`}>
      <div className="loading-content">
        <Spinner size="large" />
        <p className="loading-text">{text}</p>
      </div>
    </div>
  );
};

interface ShimmerCardProps {
  count?: number;
}

export const ShimmerCard: React.FC<ShimmerCardProps> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shimmer-card animate-fade-in">
          <div className="shimmer-card-header">
            <div className="skeleton skeleton-avatar" />
            <div className="shimmer-card-header-content">
              <div className="skeleton skeleton-title" style={{ width: '60%' }} />
              <div className="skeleton skeleton-subtitle" style={{ width: '40%' }} />
            </div>
          </div>
          <div className="shimmer-card-body">
            <div className="skeleton skeleton-text" style={{ width: '100%' }} />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '75%' }} />
          </div>
          <div className="shimmer-card-footer">
            <div className="skeleton skeleton-button" style={{ width: '80px' }} />
            <div className="skeleton skeleton-button" style={{ width: '80px' }} />
          </div>
        </div>
      ))}
    </>
  );
};

interface PulsingDotProps {
  color?: string;
  size?: number;
}

export const PulsingDot: React.FC<PulsingDotProps> = ({
  color = 'var(--color-accent-primary)',
  size = 8,
}) => {
  return (
    <span
      className="pulsing-dot animate-pulse"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
      }}
    />
  );
};

interface LoadingMessageProps {
  messages?: string[];
  interval?: number;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({
  messages = [
    'Preparing your request...',
    'Connecting to models...',
    'Processing responses...',
    'Almost ready...',
  ],
  interval = 2000,
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [messages.length, interval]);

  return (
    <div className="loading-message animate-fade-in">
      <WaveLoader />
      <p className="loading-message-text">{messages[currentIndex]}</p>
    </div>
  );
};