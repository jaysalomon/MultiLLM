// Test setup file
// Ensure essential globals exist before importing any test helpers so
// modules that register afterEach/afterAll hooks can rely on them.
// (no-op) keep existing global/window/navigator initialization below
// (no-op) keep existing global/window/navigator initialization below

// Defensive: ensure accessing `globalThis.window` always returns the
// jsdom `document.defaultView` when available and that the returned
// Window exposes a `navigator` with a configurable `clipboard` object.
// This is intentionally a getter so that any code that reads `globalThis.window`
// (including functions registered by third-party libs) will get a Window
// instance with the properties they expect, preventing `undefined` errors
// during teardown.
try {
  if (typeof document !== 'undefined' && (document as any).defaultView) {
    const dv = (document as any).defaultView as any;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get() {
        try {
          // Ensure navigator exists on the real window
          if (!dv.navigator) dv.navigator = {};
          // Ensure clipboard is a configurable property so user-event can
          // replace/restore it safely.
          if (!Object.prototype.hasOwnProperty.call(dv.navigator, 'clipboard')) {
            Object.defineProperty(dv.navigator, 'clipboard', {
              configurable: true,
              writable: true,
              value: dv.navigator.clipboard || {},
            });
          }
        } catch (e) {
          // ignore defensive setup errors
        }
        return dv;
      },
    });
  }
} catch (e) {
  // ignore
}
if (!(globalThis as any).window) {
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: globalThis,
    });
  } catch (e) {
    (globalThis as any).window = globalThis;
  }
}
if (!(globalThis as any).navigator) {
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {},
    });
  } catch (e) {
    (globalThis as any).navigator = {};
  }
}
// Provide a configurable clipboard property so user-event can attach/detach
try {
  if (!Object.prototype.hasOwnProperty.call((globalThis as any).navigator, 'clipboard')) {
    Object.defineProperty((globalThis as any).navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {},
    });
  }
} catch (e) {
  // ignore
}

// If jsdom already created a real window (document.defaultView), prefer using
// that as the global window. This ensures third-party modules that capture
// `globalThis.window` at import time receive the proper DOM Window object
// (with `navigator`) instead of the Node global. Also make sure navigator
// and clipboard exist on that window so user-event's clipboard helpers don't
// attempt to read properties of `undefined`.
try {
  const dv = (globalThis as any).document && (globalThis as any).document.defaultView;
  if (dv) {
    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: dv,
      });
    } catch (e) {
      (globalThis as any).window = dv;
    }

    // Prefer the document.defaultView.navigator as the canonical navigator
    // object for the runtime and mirror it onto globalThis.navigator as well.
    if (!dv.navigator) dv.navigator = {};
    try {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: dv.navigator,
      });
    } catch (e) {
      (globalThis as any).navigator = dv.navigator;
    }

    // Ensure a safe clipboard object exists so user-event's helpers can
    // inspect/replace it without encountering `undefined`.
    try {
      if (!Object.prototype.hasOwnProperty.call(dv.navigator, 'clipboard')) {
        Object.defineProperty(dv.navigator, 'clipboard', {
          configurable: true,
          writable: true,
          value: {},
        });
      }
    } catch (e) {
      // ignore
    }
  }
} catch (e) {
  // ignore
}

// Early, minimal shim: ensure the runtime window (document.defaultView or
// global window) exposes a configurable `navigator.clipboard` object before
// any test helpers or third-party modules (such as @testing-library/user-event)
// inspect or replace it. Defining this early prevents property access errors
// during attach/detach at teardown.
try {
  const dv = (globalThis as any).document && (globalThis as any).document.defaultView;
  const runtimeWin = dv || (globalThis as any).window || globalThis;
  if (runtimeWin) {
    try {
      if (!runtimeWin.navigator) runtimeWin.navigator = {};
      if (!Object.prototype.hasOwnProperty.call(runtimeWin.navigator, 'clipboard')) {
        Object.defineProperty(runtimeWin.navigator, 'clipboard', {
          configurable: true,
          writable: true,
          value: {},
        });
      }

      // Mirror onto document.defaultView and global navigator if present
      if (dv) {
        dv.navigator = dv.navigator || runtimeWin.navigator;
        if (!Object.prototype.hasOwnProperty.call(dv.navigator, 'clipboard')) {
          Object.defineProperty(dv.navigator, 'clipboard', {
            configurable: true,
            writable: true,
            value: runtimeWin.navigator.clipboard,
          });
        }
      }

      if (!Object.prototype.hasOwnProperty.call(globalThis, 'navigator')) {
        Object.defineProperty(globalThis, 'navigator', {
          configurable: true,
          writable: true,
          value: runtimeWin.navigator,
        });
      } else {
        (globalThis as any).navigator = runtimeWin.navigator;
      }
    } catch (e) {
      // ignore failures defining clipboard in restrictive environments
    }
  }
} catch (e) {
  // ignore
}

// Force the Node global `window` reference to point to jsdom's document.defaultView
// when available. Some third-party modules capture `globalThis.window` at import
// time and later call teardown helpers with that reference; assigning here makes
// sure they operate against the jsdom Window.
try {
  if (typeof document !== 'undefined' && (document as any).defaultView) {
    const dv = (document as any).defaultView as any;
    // Direct assignment is intentional: many libs capture `globalThis.window`
    // by value, so having the Node global reference point to the real window
    // avoids mismatches.
    (globalThis as any).window = dv;
    (globalThis as any).navigator = dv.navigator || (globalThis as any).navigator || {};

    dv.navigator = dv.navigator || (globalThis as any).navigator;
    if (!Object.prototype.hasOwnProperty.call(dv.navigator, 'clipboard')) {
      try { dv.navigator.clipboard = dv.navigator.clipboard || {}; } catch (e) { dv.navigator.clipboard = {}; }
    }

    // Ensure constructors exist on the real window as concrete functions/classes
    dv.Node = dv.Node || (globalThis as any).Node || function Node() {};
    dv.HTMLElement = dv.HTMLElement || (globalThis as any).HTMLElement || function HTMLElement() {};
    dv.Element = dv.Element || dv.HTMLElement;
    dv.HTMLIFrameElement = dv.HTMLIFrameElement || class HTMLIFrameElement extends dv.HTMLElement {};

    // Mirror back onto globalThis for any code using global constructors
    (globalThis as any).Node = (globalThis as any).Node || dv.Node;
    (globalThis as any).HTMLElement = (globalThis as any).HTMLElement || dv.HTMLElement;
    (globalThis as any).Element = (globalThis as any).Element || dv.Element;
  }
} catch (e) {
  // ignore
}

// Ensure basic DOM constructors exist on all possible runtime windows early so
// react-dom's instanceof checks don't encounter an undefined RHS.
try {
  const ensureConstructors = (win: any) => {
    if (!win) return;
    win.Node = win.Node || (globalThis as any).Node || function Node() {};
    win.HTMLElement = win.HTMLElement || (globalThis as any).HTMLElement || function HTMLElement() {};
    win.Element = win.Element || win.HTMLElement;
    win.HTMLIFrameElement = win.HTMLIFrameElement || class HTMLIFrameElement extends win.HTMLElement {};
  };
  ensureConstructors(globalThis as any);
  ensureConstructors((globalThis as any).window);
  if ((globalThis as any).document && (globalThis as any).document.defaultView) {
    ensureConstructors((globalThis as any).document.defaultView);
  }
} catch (e) {
  // ignore
}

// No custom afterEach/afterAll wrappers: let testing-library and vitest
// manage cleanup and hooks normally. We rely on the defensive `globalThis.window`
// getter and pre-defined clipboard shims above to satisfy third-party libs.

// Debugging aids: log out types so we can see what's present during tests.
// These will be removed once environment is stable.
try {
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: globalThis.window type=', typeof (globalThis as any).window);
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: globalThis.window.navigator type=', typeof ((globalThis as any).window && (globalThis as any).window.navigator));
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: globalThis.navigator type=', typeof (globalThis as any).navigator);
  // eslint-disable-next-line no-console
  try { console.debug('TEST_SETUP: window.HTMLIFrameElement type=', typeof (globalThis as any).window?.HTMLIFrameElement); } catch (e) {}
  // eslint-disable-next-line no-console
  try { console.debug('TEST_SETUP: document.defaultView.HTMLIFrameElement type=', typeof (globalThis as any).document?.defaultView?.HTMLIFrameElement); } catch (e) {}
  // eslint-disable-next-line no-console
  try { console.debug('TEST_SETUP: window.navigator.clipboard type=', typeof (globalThis as any).window?.navigator?.clipboard); } catch (e) {}
} catch (e) {
  // ignore
}

// Extra diagnostics: resolve react and react-dom paths and check constructor identity
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, no-console
  const resolvedReact = require.resolve('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires, no-console
  const resolvedReactDom = require.resolve('react-dom');
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: react resolved to', resolvedReact);
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: react-dom resolved to', resolvedReactDom);
  // Check constructor identity between globalThis and document.defaultView
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: HTMLElement === document.defaultView.HTMLElement ->', (globalThis as any).HTMLElement === (document as any)?.defaultView?.HTMLElement);
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: Node === document.defaultView.Node ->', (globalThis as any).Node === (document as any)?.defaultView?.Node);
  // eslint-disable-next-line no-console
  console.debug('TEST_SETUP: HTMLIFrameElement === document.defaultView.HTMLIFrameElement ->', (globalThis as any).HTMLIFrameElement === (document as any)?.defaultView?.HTMLIFrameElement);
} catch (e) {
  // ignore resolution errors
}

// Inform React that we're running in an environment where `act` is expected
// (helps avoid some concurrency/check errors reported by react-dom during tests)
try {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
} catch (e) {
  // ignore
}

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Import safe clipboard patch (non-invasive wrapper that calls user-event
// clipboard helpers with document.defaultView). Keeps fixes out of
// node_modules and avoids reentrancy into test framework globals.
import './user-event-clipboard-patch';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn((key: string) => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
});

// Note: Removed aggressive wrapping/patching of afterEach/afterAll and
// dynamic requiring of @testing-library/user-event's internal clipboard
// helpers. Those earlier patches attempted to defensively force a stable
// Window during teardown but introduced order/reentrancy problems that
// caused React "act" concurrency errors. The simpler shims above ensure
// `document.defaultView` / `globalThis.window` and `navigator.clipboard`
// exist which is sufficient for user-event in most cases. If future
// issues reappear, prefer lightweight shims rather than wrapping test
// framework globals.

// Ensure navigator exists on globalThis/window/document.defaultView so
// @testing-library/user-event can safely attach and detach its clipboard stub.
// Define a configurable but undefined clipboard property so user-event can
// replace/restore it without causing property access errors.
try {
  if (!(globalThis as any).window) {
    (globalThis as any).window = globalThis;
  }

  // Ensure a shared navigator object exists and is defined via
  // Object.defineProperty so it's visible and configurable across
  // different VM contexts that vitest/jsdom may use.
  if (!Object.prototype.hasOwnProperty.call(globalThis, 'navigator')) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {},
    });
  }

  if (typeof window !== 'undefined') {
    if (!Object.prototype.hasOwnProperty.call(window, 'navigator')) {
      Object.defineProperty(window, 'navigator', {
        configurable: true,
        writable: true,
        value: (globalThis as any).navigator,
      });
    }
  }

  if (document && (document as any).defaultView) {
    const dv = (document as any).defaultView;
    if (!Object.prototype.hasOwnProperty.call(dv, 'navigator')) {
      Object.defineProperty(dv, 'navigator', {
        configurable: true,
        writable: true,
        value: (globalThis as any).navigator,
      });
    }
  }

  // Make sure navigator.clipboard exists as a configurable property so
  // @testing-library/user-event can define/get/reset it without throwing
  // when it inspects or restores the descriptor.
  try {
    const nav = ((typeof window !== 'undefined' ? (window as any).navigator : (globalThis as any).navigator) || (globalThis as any).navigator);
    if (nav && !Object.prototype.hasOwnProperty.call(nav, 'clipboard')) {
      Object.defineProperty(nav, 'clipboard', {
        configurable: true,
        writable: true,
        value: {},
      });
    }
  } catch (e) {
    // Ignore issues defining clipboard in restrictive environments
  }
} catch (e) {
  // Ignore if environment prevents defining globals
}

// Ensure globalThis.window exists and is the same object as document.defaultView
if (!Object.prototype.hasOwnProperty.call(globalThis, 'window')) {
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: (typeof window !== 'undefined' ? (window as any) : globalThis),
    });
  } catch (e) {
    // ignore
  }
}

// Make sure the runtime window (document.defaultView) has the same constructors and navigator
try {
  const win = (typeof window !== 'undefined' ? (window as any) : (globalThis as any).window);
  if (win) {
    win.Node = win.Node || (globalThis as any).Node;
    win.HTMLElement = win.HTMLElement || (globalThis as any).HTMLElement;
    win.Element = win.Element || win.HTMLElement;
    win.getSelection = win.getSelection || (() => (document as any).getSelection());
    win.navigator = win.navigator || (globalThis as any).navigator;
    if (!Object.prototype.hasOwnProperty.call(win.navigator, 'clipboard')) {
      try {
        Object.defineProperty(win.navigator, 'clipboard', {
          configurable: true,
          writable: true,
          value: {},
        });
      } catch (e) {
        // ignore
      }
    }
  }

  if (document && (document as any).defaultView) {
    const dv = (document as any).defaultView;
    dv.Node = dv.Node || (globalThis as any).Node;
    dv.HTMLElement = dv.HTMLElement || (globalThis as any).HTMLElement;
    dv.Element = dv.Element || dv.HTMLElement;
    dv.getSelection = dv.getSelection || (() => (document as any).getSelection());
    dv.navigator = dv.navigator || (globalThis as any).navigator;
    if (!Object.prototype.hasOwnProperty.call(dv.navigator, 'clipboard')) {
      try {
        Object.defineProperty(dv.navigator, 'clipboard', {
          configurable: true,
          writable: true,
          value: {},
        });
      } catch (e) {
        // ignore
      }
    }
  }
} catch (e) {
  // ignore
}

// Final guard: ensure the active runtime window (the one React and
// @testing-library/user-event will observe) has the needed properties.
try {
  const runtimeWindow = (typeof window !== 'undefined' ? (window as any) : (document && (document as any).defaultView) || (globalThis as any).window || globalThis) as any;

  runtimeWindow.navigator = runtimeWindow.navigator || {};
  // ensure clipboard property exists and is configurable (user-event will
  // replace/restore it)
  if (!Object.prototype.hasOwnProperty.call(runtimeWindow.navigator, 'clipboard')) {
    try {
      Object.defineProperty(runtimeWindow.navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    } catch (e) {
      // ignore
    }
  }

  runtimeWindow.Node = runtimeWindow.Node || (globalThis as any).Node || function Node() {};
  runtimeWindow.HTMLElement = runtimeWindow.HTMLElement || (globalThis as any).HTMLElement || function HTMLElement() {};
  runtimeWindow.Element = runtimeWindow.Element || runtimeWindow.HTMLElement;

  // Ensure iframe constructor exists so `instanceof win.HTMLIFrameElement` checks
  // in react-dom do not throw when the RHS is undefined.
  runtimeWindow.HTMLIFrameElement = runtimeWindow.HTMLIFrameElement || class HTMLIFrameElement extends runtimeWindow.HTMLElement {};

  // Ensure navigator exists on the runtime window and has a clipboard object so
  // user-event's clipboard helpers can safely access/replace it.
  runtimeWindow.navigator = runtimeWindow.navigator || (globalThis as any).navigator || {};
  if (!Object.prototype.hasOwnProperty.call(runtimeWindow.navigator, 'clipboard')) {
    try {
      Object.defineProperty(runtimeWindow.navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: {},
      });
    } catch (e) {
      runtimeWindow.navigator.clipboard = {};
    }
  }

  // Mirror these onto document.defaultView if available
  if (document && (document as any).defaultView) {
    const dv = (document as any).defaultView;
    dv.navigator = dv.navigator || runtimeWindow.navigator;
    dv.Node = dv.Node || runtimeWindow.Node;
    dv.HTMLElement = dv.HTMLElement || runtimeWindow.HTMLElement;
    dv.Element = dv.Element || runtimeWindow.Element;
  }
} catch (e) {
  // ignore
}

// Provide a Selection-like object for document.getSelection / window.getSelection
// React DOM performs instanceof checks against global Node/Element constructors,
// ensure those exist on the global scope (some environments may not expose them).

// Ensure basic DOM constructors exist so React's instanceof checks succeed.
if (!(globalThis as any).Node) {
  (globalThis as any).Node = class Node {}
}
if (typeof window !== 'undefined' && !(window as any).Node) {
  (window as any).Node = (globalThis as any).Node;
}

if (typeof window !== 'undefined' && !(window as any).HTMLElement) {
  (window as any).HTMLElement = class HTMLElement extends (window as any).Node {};
}
if (typeof window !== 'undefined' && !(window as any).Element) {
  (window as any).Element = (window as any).HTMLElement;
}

// Provide a minimal Selection-like object for document.getSelection / window.getSelection
if (!document.getSelection) {
  (document as any).getSelection = () => ({
    removeAllRanges: () => {},
    addRange: () => {},
    getRangeAt: () => undefined,
    toString: () => '',
    rangeCount: 0,
    anchorNode: null,
    focusNode: null,
  } as any);
}

// Also ensure window.getSelection exists and delegates to document.getSelection
if (typeof window !== 'undefined' && !(window as any).getSelection) {
  (window as any).getSelection = () => (document as any).getSelection();
}

// Ensure there is an activeElement for getActiveElementDeep
if (!document.activeElement) {
  (document as any).activeElement = document.body;
}

// Ensure window.navigator exists (some environments may not expose it)
if (typeof window !== 'undefined') {
  (window as any).navigator = (window as any).navigator || {};
  // Ensure constructors used by React DOM instanceof checks exist on window
  (window as any).Node = (window as any).Node || (globalThis as any).Node || function Node() {};
  (window as any).HTMLElement = (window as any).HTMLElement || function HTMLElement() {};
  (window as any).Element = (window as any).Element || (window as any).HTMLElement;
}

// Mock ResizeObserver
class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Mock electronAPI for MessageFeedback
Object.defineProperty(window, 'electronAPI', {
  value: {
    saveFeedback: vi.fn(),
    saveConversation: vi.fn(),
    loadConversations: vi.fn(),
    deleteConversation: vi.fn(),
  },
  writable: true,
});

// Mock Date.now for consistent testing
const mockDate = new Date('2024-01-01T00:00:00.000Z');
vi.setSystemTime(mockDate);