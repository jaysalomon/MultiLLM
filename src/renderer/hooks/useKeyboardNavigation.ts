import { useEffect, useCallback, RefObject } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: () => void;
  description?: string;
}

interface UseKeyboardNavigationOptions {
  shortcuts?: KeyboardShortcut[];
  enableArrowNavigation?: boolean;
  containerRef?: RefObject<HTMLElement>;
}

export const useKeyboardNavigation = (options: UseKeyboardNavigationOptions = {}) => {
  const { shortcuts = [], enableArrowNavigation = false, containerRef } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for keyboard shortcuts
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

        if (
          event.key === shortcut.key &&
          ctrlMatch &&
          altMatch &&
          shiftMatch
        ) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }

      // Arrow key navigation for focusable elements
      if (enableArrowNavigation && containerRef?.current) {
        const focusableElements = getFocusableElements(containerRef.current);
        const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

        if (currentIndex !== -1) {
          let nextIndex = -1;

          switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
              nextIndex = (currentIndex + 1) % focusableElements.length;
              break;
            case 'ArrowUp':
            case 'ArrowLeft':
              nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
              break;
            case 'Home':
              nextIndex = 0;
              break;
            case 'End':
              nextIndex = focusableElements.length - 1;
              break;
          }

          if (nextIndex !== -1) {
            event.preventDefault();
            focusableElements[nextIndex].focus();
          }
        }
      }

      // Escape key to close modals/dialogs
      if (event.key === 'Escape') {
        const modal = document.querySelector('[role="dialog"], [role="alertdialog"]');
        if (modal) {
          const closeButton = modal.querySelector('[aria-label*="close" i], [aria-label*="cancel" i], button[class*="close" i]') as HTMLElement;
          if (closeButton) {
            closeButton.click();
          }
        }
      }
    },
    [shortcuts, enableArrowNavigation, containerRef]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    registerShortcut: (shortcut: KeyboardShortcut) => {
      shortcuts.push(shortcut);
    },
  };
};

// Helper function to get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const elements = container.querySelectorAll<HTMLElement>(focusableSelectors.join(','));
  return Array.from(elements).filter((el) => {
    // Filter out invisible elements
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      el.offsetParent !== null
    );
  });
}

// Global keyboard shortcuts
export const globalKeyboardShortcuts: KeyboardShortcut[] = [
  {
    key: '/',
    ctrl: true,
    handler: () => {
      const messageInput = document.querySelector<HTMLElement>('[aria-label="Message input"]');
      if (messageInput) {
        messageInput.focus();
      }
    },
    description: 'Focus message input',
  },
  {
    key: 'k',
    ctrl: true,
    handler: () => {
      // Trigger command palette (to be implemented)
      const event = new CustomEvent('openCommandPalette');
      document.dispatchEvent(event);
    },
    description: 'Open command palette',
  },
  {
    key: ',',
    ctrl: true,
    handler: () => {
      // Open settings
      const event = new CustomEvent('openSettings');
      document.dispatchEvent(event);
    },
    description: 'Open settings',
  },
];

// Focus trap hook for modals and dialogs
export const useFocusTrap = (containerRef: RefObject<HTMLElement>, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);

    if (focusableElements.length === 0) return;

    // Store the previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Focus the first focusable element
    focusableElements[0].focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, isActive]);
};

// Skip to content link support
export const createSkipToContent = () => {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-to-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.setAttribute('aria-label', 'Skip to main content');

  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView();
    }
  });

  return skipLink;
};