import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark' | 'high-contrast-light' | 'high-contrast-dark';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  fontSize: FontSize;
  highContrast: boolean;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setHighContrast: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): 'light' | 'dark' => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('app-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  return 'system';
};

const getStoredFontSize = (): FontSize => {
  try {
    const stored = localStorage.getItem('app-font-size');
    if (stored === 'small' || stored === 'medium' || stored === 'large' || stored === 'extra-large') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read font size from localStorage:', error);
  }
  return 'medium';
};

const getStoredHighContrast = (): boolean => {
  try {
    return localStorage.getItem('app-high-contrast') === 'true';
  } catch (error) {
    console.warn('Failed to read high contrast setting from localStorage:', error);
    return false;
  }
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [fontSize, setFontSizeState] = useState<FontSize>(getStoredFontSize);
  const [highContrast, setHighContrastState] = useState<boolean>(getStoredHighContrast);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Calculate the effective color scheme
  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const colorScheme: ColorScheme = highContrast
    ? (effectiveTheme === 'dark' ? 'high-contrast-dark' : 'high-contrast-light')
    : effectiveTheme;

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', colorScheme);
    document.documentElement.setAttribute('data-font-size', fontSize);

    // Apply theme classes for CSS
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-high-contrast-light', 'theme-high-contrast-dark');
    document.documentElement.classList.add(`theme-${colorScheme}`);

    // Apply font size classes
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
    document.documentElement.classList.add(`font-${fontSize}`);
  }, [colorScheme, fontSize]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app-theme', newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  };

  const setFontSize = (newSize: FontSize) => {
    setFontSizeState(newSize);
    try {
      localStorage.setItem('app-font-size', newSize);
    } catch (error) {
      console.warn('Failed to save font size to localStorage:', error);
    }
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
    try {
      localStorage.setItem('app-high-contrast', enabled.toString());
    } catch (error) {
      console.warn('Failed to save high contrast setting to localStorage:', error);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colorScheme,
        fontSize,
        highContrast,
        setTheme,
        setFontSize,
        setHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};