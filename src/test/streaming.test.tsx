import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { useStreamingResponse } from '../renderer/hooks/useStreamingResponse';
import StreamingMessageBubble from '../renderer/components/chat/StreamingMessageBubble';
import StreamingConversationHistory from '../renderer/components/chat/StreamingConversationHistory';

// Mock fetch for streaming tests
global.fetch = vi.fn();

describe('Streaming Response Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useStreamingResponse Hook', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useStreamingResponse());

      expect(result.current.streamingMessages).toHaveLength(0);
      expect(result.current.activeStreamsCount).toBe(0);
      expect(result.current.isStreaming).toBe(false);
    });

    it('should handle streaming start and updates', async () => {
      const onUpdate = vi.fn();
      const onComplete = vi.fn();

      const { result } = renderHook(() =>
        useStreamingResponse({
          onMessageUpdate: onUpdate,
          onMessageComplete: onComplete,
        })
      );

      // Create mock streaming response
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'));
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const providerConfig = {
        type: 'api',
        config: {
          apiKey: 'test-key',
          modelName: 'gpt-3.5-turbo',
        },
      };

      await act(async () => {
        await result.current.startStreaming(
          'msg-1',
          'provider-1',
          providerConfig,
          [{ role: 'user', content: 'Test' }]
        );
      });

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith('msg-1', 'Hello world');
        expect(onComplete).toHaveBeenCalledWith('msg-1', 'Hello world');
      });
    });

    it('should handle stream cancellation', async () => {
      const { result } = renderHook(() => useStreamingResponse());

      // Start a stream
      const mockStream = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Test"}}]}\n\n'));
          }, 100);
        },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      act(() => {
        result.current.startStreaming(
          'msg-1',
          'provider-1',
          { type: 'api', config: {} },
          []
        );
      });

      // Cancel the stream
      act(() => {
        result.current.cancelStream('msg-1');
      });

      const status = result.current.getStreamingStatus('msg-1');
      expect(status.error).toBe('Stream cancelled by user');
    });

    it('should handle concurrent streams', async () => {
      const { result } = renderHook(() =>
        useStreamingResponse({ maxConcurrentStreams: 2 })
      );

      const createMockStream = () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Response"}}]}\n\n'));
            controller.close();
          },
        });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      // Start multiple streams
      await act(async () => {
        result.current.startStreaming('msg-1', 'provider-1', { type: 'api', config: {} }, []);
        result.current.startStreaming('msg-2', 'provider-2', { type: 'api', config: {} }, []);
        result.current.startStreaming('msg-3', 'provider-3', { type: 'api', config: {} }, []);
      });

      // Should respect max concurrent limit
      expect(result.current.activeStreamsCount).toBeLessThanOrEqual(2);
    });

    it('should handle streaming errors', async () => {
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useStreamingResponse({ onError })
      );

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.startStreaming(
          'msg-1',
          'provider-1',
          { type: 'api', config: {} },
          []
        );
      });

      expect(onError).toHaveBeenCalledWith('msg-1', 'Network error');
    });
  });

  describe('StreamingMessageBubble Component', () => {
    it('should display streaming indicator when streaming', () => {
      const message = {
        id: 'msg-1',
        content: '',
        streamContent: 'Hello',
        sender: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };

      render(<StreamingMessageBubble message={message} />);

      expect(screen.getByLabelText(/streaming/i)).toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('should show cancel button during streaming', () => {
      const onCancel = vi.fn();
      const message = {
        id: 'msg-1',
        content: '',
        sender: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };

      render(<StreamingMessageBubble message={message} onCancel={onCancel} />);

      const cancelButton = screen.getByLabelText(/cancel streaming/i);
      expect(cancelButton).toBeInTheDocument();
    });

    it('should display error state', () => {
      const message = {
        id: 'msg-1',
        content: 'Partial response',
        sender: 'assistant',
        timestamp: new Date(),
        isStreaming: false,
        error: 'Connection lost',
      };

      render(<StreamingMessageBubble message={message} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Connection lost')).toBeInTheDocument();
    });

    it('should show token count during streaming', () => {
      const message = {
        id: 'msg-1',
        content: '',
        streamContent: 'This is a test message',
        sender: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };

      render(<StreamingMessageBubble message={message} />);

      expect(screen.getByText(/5 tokens/i)).toBeInTheDocument();
    });
  });

  describe('StreamingConversationHistory Component', () => {
    it('should display both regular and streaming messages', () => {
      const messages = [
        {
          id: 'msg-1',
          content: 'Regular message',
          sender: 'user',
          timestamp: new Date(),
        },
      ];

      const streamingMessages = new Map([
        [
          'msg-2',
          {
            id: 'msg-2',
            content: '',
            streamContent: 'Streaming response',
            sender: 'assistant',
            timestamp: new Date(),
            isStreaming: true,
          },
        ],
      ]);

      render(
        <StreamingConversationHistory
          messages={messages}
          streamingMessages={streamingMessages}
          participants={[]}
        />
      );

      expect(screen.getByText('Regular message')).toBeInTheDocument();
      expect(screen.getByText('Streaming response')).toBeInTheDocument();
    });

    it('should show streaming status indicator', () => {
      const streamingMessages = new Map([
        ['msg-1', { id: 'msg-1', content: '', sender: 'ai-1', timestamp: new Date(), isStreaming: true }],
        ['msg-2', { id: 'msg-2', content: '', sender: 'ai-2', timestamp: new Date(), isStreaming: true }],
      ]);

      render(
        <StreamingConversationHistory
          messages={[]}
          streamingMessages={streamingMessages}
          participants={[]}
        />
      );

      expect(screen.getByText(/2 models responding/i)).toBeInTheDocument();
    });

    it('should handle cancel all streams', async () => {
      const onCancelStream = vi.fn();
      const user = userEvent.setup();

      const streamingMessages = new Map([
        ['msg-1', { id: 'msg-1', content: '', sender: 'ai-1', timestamp: new Date(), isStreaming: true }],
        ['msg-2', { id: 'msg-2', content: '', sender: 'ai-2', timestamp: new Date(), isStreaming: true }],
      ]);

      render(
        <StreamingConversationHistory
          messages={[]}
          streamingMessages={streamingMessages}
          participants={[]}
          onCancelStream={onCancelStream}
        />
      );

      const cancelAllButton = screen.getByLabelText(/cancel all streams/i);
      await user.click(cancelAllButton);

      expect(onCancelStream).toHaveBeenCalledTimes(2);
      expect(onCancelStream).toHaveBeenCalledWith('msg-1');
      expect(onCancelStream).toHaveBeenCalledWith('msg-2');
    });

    it('should show retry button for failed messages', () => {
      const onRetry = vi.fn();

      const streamingMessages = new Map([
        [
          'msg-1',
          {
            id: 'msg-1',
            content: 'Partial',
            sender: 'assistant',
            timestamp: new Date(),
            isStreaming: false,
            error: 'Failed',
          },
        ],
      ]);

      const { container } = render(
        <StreamingConversationHistory
          messages={[]}
          streamingMessages={streamingMessages}
          participants={[]}
          onRetryMessage={onRetry}
        />
      );

      // Hover to show retry button
      const messageWrapper = container.querySelector('.message-wrapper');
      if (messageWrapper) {
        userEvent.hover(messageWrapper);
      }

      expect(screen.getByLabelText(/retry failed message/i)).toBeInTheDocument();
    });

    it('should auto-scroll during streaming', async () => {
      const scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(
        <StreamingConversationHistory
          messages={[]}
          streamingMessages={new Map()}
          participants={[]}
          autoScroll={true}
        />
      );

      // Add streaming message
      const streamingMessages = new Map([
        ['msg-1', { id: 'msg-1', content: 'Test', sender: 'ai', timestamp: new Date(), isStreaming: true }],
      ]);

      rerender(
        <StreamingConversationHistory
          messages={[]}
          streamingMessages={streamingMessages}
          participants={[]}
          autoScroll={true}
        />
      );

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should batch updates during streaming', async () => {
      const { result } = renderHook(() => useStreamingResponse());

      let updateCount = 0;
      const onUpdate = vi.fn(() => updateCount++);

      // Simulate rapid updates
      const mockStream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < 10; i++) {
            controller.enqueue(
              new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"word${i} "}}]}\n\n`)
            );
          }
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      await act(async () => {
        await result.current.startStreaming(
          'msg-1',
          'provider-1',
          { type: 'api', config: {} },
          [],
          onUpdate
        );
      });

      // Updates should be batched, not called 10 times
      expect(updateCount).toBeLessThan(10);
    });

    it('should limit concurrent streams', () => {
      const { result } = renderHook(() =>
        useStreamingResponse({ maxConcurrentStreams: 3 })
      );

      // Try to start more streams than allowed
      for (let i = 0; i < 5; i++) {
        result.current.startStreaming(
          `msg-${i}`,
          `provider-${i}`,
          { type: 'api', config: {} },
          []
        );
      }

      expect(result.current.activeStreamsCount).toBeLessThanOrEqual(3);
    });
  });
});