import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage } from '../../types/chat';
import type { ContextSource, InjectedContext } from '../../types/context';
import { logger } from '../../utils/Logger';
import { performanceMonitor } from '../../utils/PerformanceMonitor';

interface UseContextInjectionOptions {
  maxTokens?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enabled?: boolean;
}

interface ContextInjectionState {
  sources: ContextSource[];
  injectedContext: InjectedContext | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing context injection in chat conversations
 * Requirement: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export function useContextInjection(options: UseContextInjectionOptions = {}) {
  const {
    maxTokens = 4000,
    autoRefresh = true,
    refreshInterval = 30000,
    enabled = true
  } = options;

  const [state, setState] = useState<ContextInjectionState>({
    sources: [],
    injectedContext: null,
    isLoading: false,
    error: null
  });

  const refreshTimerRef = useRef<NodeJS.Timeout>();

  // Add a context source
  const addSource = useCallback(async (source: Omit<ContextSource, 'id' | 'lastUpdated'>) => {
    if (!enabled) return;

    const timer = performanceMonitor.startTimer('context_add_source');

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Call IPC to add source through main process
      const newSource = await window.electronAPI.addContextSource(source);

      setState(prev => ({
        ...prev,
        sources: [...prev.sources, newSource],
        isLoading: false
      }));

      logger.info('Context source added', { sourceType: source.type, path: source.path });
      performanceMonitor.endTimer('context_add_source');

      // Refresh context after adding source
      await refreshContext();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to add context source';
      setState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      logger.error('Failed to add context source', { source }, error as Error);
      performanceMonitor.endTimer('context_add_source');
    }
  }, [enabled]);

  // Remove a context source
  const removeSource = useCallback(async (sourceId: string) => {
    try {
      await window.electronAPI.removeContextSource(sourceId);

      setState(prev => ({
        ...prev,
        sources: prev.sources.filter(s => s.id !== sourceId)
      }));

      logger.info('Context source removed', { sourceId });

      // Refresh context after removing source
      await refreshContext();

    } catch (error) {
      logger.error('Failed to remove context source', { sourceId }, error as Error);
    }
  }, []);

  // Refresh context from all sources
  const refreshContext = useCallback(async () => {
    if (!enabled || state.sources.length === 0) {
      setState(prev => ({ ...prev, injectedContext: null }));
      return;
    }

    const timer = performanceMonitor.startTimer('context_refresh');

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get current conversation context
      const messages = await window.electronAPI.getCurrentMessages?.() || [];
      const query = messages.slice(-1)[0]?.content || '';

      // Request context injection through main process
      const injected = await window.electronAPI.getInjectedContext({
        query,
        maxTokens,
        sources: state.sources.map(s => s.id)
      });

      setState(prev => ({
        ...prev,
        injectedContext: injected,
        isLoading: false
      }));

      performanceMonitor.endTimer('context_refresh', 'context', {
        tokenCount: injected.tokenCount,
        sourceCount: state.sources.length
      });

      logger.info('Context refreshed', {
        tokenCount: injected.tokenCount,
        compressionApplied: injected.compressionApplied
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to refresh context';
      setState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      logger.error('Failed to refresh context', {}, error as Error);
      performanceMonitor.endTimer('context_refresh');
    }
  }, [enabled, state.sources, maxTokens]);

  // Add file context
  const addFileContext = useCallback(async (filePath: string) => {
    await addSource({
      type: 'file',
      path: filePath,
      metadata: {
        fileName: filePath.split(/[\\/]/).pop() || filePath
      }
    });
  }, [addSource]);

  // Add web context
  const addWebContext = useCallback(async (url: string) => {
    // Validate URL
    try {
      new URL(url);
    } catch {
      setState(prev => ({ ...prev, error: 'Invalid URL' }));
      return;
    }

    await addSource({
      type: 'web',
      path: url,
      metadata: {
        url
      }
    });
  }, [addSource]);

  // Add git repository context
  const addGitContext = useCallback(async (repoPath: string, branch?: string) => {
    await addSource({
      type: 'git',
      path: repoPath,
      metadata: {
        branch: branch || 'main'
      }
    });
  }, [addSource]);

  // Add conversation context
  const addConversationContext = useCallback(async (conversationId: string) => {
    await addSource({
      type: 'conversation',
      path: conversationId,
      metadata: {
        conversationId
      }
    });
  }, [addSource]);

  // Get context for message
  const getContextForMessage = useCallback((message: ChatMessage): string => {
    if (!state.injectedContext || !enabled) {
      return '';
    }

    // Build context string
    const contextParts: string[] = [];

    if (state.injectedContext.content) {
      contextParts.push('### Context Information ###');
      contextParts.push(state.injectedContext.content);
      contextParts.push('');
    }

    // Add source attributions
    if (state.injectedContext.sources.length > 0) {
      contextParts.push('### Sources ###');
      state.injectedContext.sources.forEach(source => {
        contextParts.push(`- ${source.type}: ${source.path}`);
      });
      contextParts.push('');
    }

    return contextParts.join('\n');
  }, [state.injectedContext, enabled]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && enabled && state.sources.length > 0) {
      refreshTimerRef.current = setInterval(() => {
        refreshContext();
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, [autoRefresh, enabled, refreshInterval, state.sources.length, refreshContext]);

  // Load saved sources on mount
  useEffect(() => {
    const loadSources = async () => {
      try {
        const saved = await window.electronAPI.getContextSources?.();
        if (saved && saved.length > 0) {
          setState(prev => ({ ...prev, sources: saved }));
          await refreshContext();
        }
      } catch (error) {
        logger.warn('Failed to load saved context sources', error);
      }
    };

    if (enabled) {
      loadSources();
    }
  }, [enabled]);

  return {
    // State
    sources: state.sources,
    injectedContext: state.injectedContext,
    isLoading: state.isLoading,
    error: state.error,
    hasContext: !!state.injectedContext && state.injectedContext.tokenCount > 0,

    // Actions
    addSource,
    removeSource,
    refreshContext,
    addFileContext,
    addWebContext,
    addGitContext,
    addConversationContext,
    getContextForMessage,

    // Utilities
    clearSources: useCallback(async () => {
      for (const source of state.sources) {
        await removeSource(source.id);
      }
    }, [state.sources, removeSource]),

    getTokenUsage: useCallback(() => ({
      used: state.injectedContext?.tokenCount || 0,
      available: maxTokens
    }), [state.injectedContext, maxTokens])
  };
}

export default useContextInjection;