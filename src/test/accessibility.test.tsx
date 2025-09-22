import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ThemeProvider } from '../renderer/contexts/ThemeContext';
import { ThemeSettings } from '../renderer/components/settings/ThemeSettings';

describe('Accessibility Tests', () => {
  describe('Theme Settings', () => {
    it('should render theme settings with proper labels', () => {
      render(
        <ThemeProvider>
          <ThemeSettings />
        </ThemeProvider>
      );

      // Check for theme selector
      expect(screen.getByLabelText(/theme/i)).toBeInTheDocument();

      // Check for font size selector
      expect(screen.getByLabelText(/font size/i)).toBeInTheDocument();

      // Check for high contrast toggle
      expect(screen.getByLabelText(/high contrast mode/i)).toBeInTheDocument();
    });

    it('should change theme when selected', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeSettings />
        </ThemeProvider>
      );

      const themeSelect = screen.getByLabelText(/theme/i) as HTMLSelectElement;

      // Change to dark theme
      await user.selectOptions(themeSelect, 'dark');
      expect(themeSelect.value).toBe('dark');

      // Change to light theme
      await user.selectOptions(themeSelect, 'light');
      expect(themeSelect.value).toBe('light');
    });

    it('should change font size when selected', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeSettings />
        </ThemeProvider>
      );

      const fontSelect = screen.getByLabelText(/font size/i) as HTMLSelectElement;

      // Test font size changes
      await user.selectOptions(fontSelect, 'large');
      expect(fontSelect.value).toBe('large');

      await user.selectOptions(fontSelect, 'small');
      expect(fontSelect.value).toBe('small');
    });

    it('should toggle high contrast mode', async () => {
      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeSettings />
        </ThemeProvider>
      );

      const highContrastToggle = screen.getByLabelText(/high contrast mode/i) as HTMLInputElement;

      // Initially unchecked
      expect(highContrastToggle.checked).toBe(false);

      // Toggle on
      await user.click(highContrastToggle);
      expect(highContrastToggle.checked).toBe(true);

      // Toggle off
      await user.click(highContrastToggle);
      expect(highContrastToggle.checked).toBe(false);
    });

    it('should display keyboard shortcuts', () => {
      render(
        <ThemeProvider>
          <ThemeSettings />
        </ThemeProvider>
      );

      // Check for keyboard shortcuts section
      expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();

      // Check for specific shortcuts
      expect(screen.getByText(/focus message input/i)).toBeInTheDocument();
      expect(screen.getByText(/open command palette/i)).toBeInTheDocument();
      expect(screen.getByText(/open settings/i)).toBeInTheDocument();
    });
  });
});