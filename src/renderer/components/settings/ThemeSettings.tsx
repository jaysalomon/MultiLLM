import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './ThemeSettings.css';

export const ThemeSettings: React.FC = () => {
  const { theme, fontSize, highContrast, setTheme, setFontSize, setHighContrast } = useTheme();

  return (
    <div className="theme-settings" role="region" aria-label="Theme and Accessibility Settings">
      <h2 className="settings-section-title">Appearance & Accessibility</h2>

      {/* Theme Selection */}
      <div className="settings-group">
        <label htmlFor="theme-select" className="settings-label">
          Theme
        </label>
        <select
          id="theme-select"
          className="settings-select"
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          aria-describedby="theme-description"
        >
          <option value="system">System Default</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p id="theme-description" className="settings-description">
          Choose your preferred color theme or follow system settings
        </p>
      </div>

      {/* Font Size Selection */}
      <div className="settings-group">
        <label htmlFor="font-size-select" className="settings-label">
          Font Size
        </label>
        <select
          id="font-size-select"
          className="settings-select"
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value as 'small' | 'medium' | 'large' | 'extra-large')}
          aria-describedby="font-size-description"
        >
          <option value="small">Small</option>
          <option value="medium">Medium (Default)</option>
          <option value="large">Large</option>
          <option value="extra-large">Extra Large</option>
        </select>
        <p id="font-size-description" className="settings-description">
          Adjust text size for better readability
        </p>
      </div>

      {/* High Contrast Toggle */}
      <div className="settings-group">
        <div className="settings-toggle-group">
          <input
            type="checkbox"
            id="high-contrast-toggle"
            className="settings-checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
            aria-describedby="high-contrast-description"
          />
          <label htmlFor="high-contrast-toggle" className="settings-label">
            High Contrast Mode
          </label>
        </div>
        <p id="high-contrast-description" className="settings-description">
          Enhance color contrast for better visibility
        </p>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="settings-group">
        <h3 className="settings-subtitle">Keyboard Shortcuts</h3>
        <div className="keyboard-shortcuts" role="list">
          <div className="shortcut-item" role="listitem">
            <kbd className="shortcut-key">Ctrl</kbd> + <kbd className="shortcut-key">/</kbd>
            <span className="shortcut-description">Focus message input</span>
          </div>
          <div className="shortcut-item" role="listitem">
            <kbd className="shortcut-key">Ctrl</kbd> + <kbd className="shortcut-key">K</kbd>
            <span className="shortcut-description">Open command palette</span>
          </div>
          <div className="shortcut-item" role="listitem">
            <kbd className="shortcut-key">Ctrl</kbd> + <kbd className="shortcut-key">,</kbd>
            <span className="shortcut-description">Open settings</span>
          </div>
          <div className="shortcut-item" role="listitem">
            <kbd className="shortcut-key">Escape</kbd>
            <span className="shortcut-description">Close dialog/modal</span>
          </div>
          <div className="shortcut-item" role="listitem">
            <kbd className="shortcut-key">Tab</kbd>
            <span className="shortcut-description">Navigate through elements</span>
          </div>
        </div>
      </div>

      {/* Screen Reader Notice */}
      <div className="settings-group">
        <h3 className="settings-subtitle">Screen Reader Support</h3>
        <p className="settings-description">
          This application includes comprehensive ARIA labels and landmarks for screen reader navigation.
          All interactive elements are keyboard accessible.
        </p>
      </div>
    </div>
  );
};