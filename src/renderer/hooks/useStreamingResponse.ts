import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types/chat';

interface StreamingMessage extends ChatMessage {
  isStreaming?: boolean;
  streamContent?: string;
  error?: string;
}

interface UseStreamingResponseOptions {
  onMessageUpdate?: (messageId: string, content: string) => void;
  onMessageComplete?: (messageId: string, finalContent: string) => void;
  onError?: (messageId: string, error: string) => void;
  maxConcurrentStreams?: number;
}

interface StreamController {
  abortController: AbortController;
  messageId: string;
  providerId: string;
  startTime: number;
}

export const useStreamingResponse = (options: UseStreamingResponseOptions = {}) => {
  const {
    onMessageUpdate,
    onMessageComplete,
    onError,
    maxConcurrentStreams = 10
  } = options;

  const [streamingMessages, setStreamingMessages] = useState<Map<string, StreamingMessage>>(new Map());
  const [activeStreams, setActiveStreams] = useState<Map<string, StreamController>>(new Map());
  const streamQueues = useRef<Map<string, string[]>>(new Map());

  // Start streaming for a provider
  const startStreaming = useCallback(async (
    messageId: string,
    providerId: string,
    providerConfig: any,
    messages: any[],
    onChunk?: (chunk: string) => void
  ) => {
    // Check if we're at max concurrent streams
    if (activeStreams.size >= maxConcurrentStreams) {
      // Queue this stream
      if (!streamQueues.current.has(providerId)) {
        streamQueues.current.set(providerId, []);
      }
      streamQueues.current.get(providerId)?.push(messageId);
      return;
    }

    const abortController = new AbortController();
    const streamController: StreamController = {
      abortController,
      messageId,
      providerId,
      startTime: Date.now()
    };

    setActiveStreams(prev => new Map(prev).set(messageId, streamController));

    // Initialize streaming message
    const streamingMsg: StreamingMessage = {
      id: messageId,
      content: '',
      sender: providerId,
      timestamp: new Date(),
      isStreaming: true,
      streamContent: ''
    };

    setStreamingMessages(prev => new Map(prev).set(messageId, streamingMsg));

    try {
      let endpoint = '';
      let requestBody: any = {};

      if (providerConfig.type === 'ollama') {
        endpoint = 'http://localhost:11434/api/chat';
        requestBody = {
          model: providerConfig.config.modelName,
          messages: messages,
          stream: true,
          options: {
            temperature: providerConfig.config.temperature || 0.7,
            num_predict: providerConfig.config.maxTokens || 500
          }
        };
      } else if (providerConfig.type === 'lmstudio') {
        endpoint = `${providerConfig.config.baseUrl || 'http://localhost:1234'}/v1/chat/completions`;
        requestBody = {
          model: providerConfig.config.modelName,
          messages: messages,
          stream: true,
          temperature: providerConfig.config.temperature || 0.7,
          max_tokens: providerConfig.config.maxTokens || 500
        };
      } else if (providerConfig.type === 'api') {
        // Handle API providers (OpenAI, Anthropic, etc.)
        const baseUrl = providerConfig.config.baseUrl || 'https://api.openai.com';
        endpoint = `${baseUrl}/v1/chat/completions`;
        requestBody = {
          model: providerConfig.config.modelName,
          messages: messages,
          stream: true,
          temperature: providerConfig.config.temperature || 0.7,
          max_tokens: providerConfig.config.maxTokens || 500
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(providerConfig.config.apiKey && {
            'Authorization': `Bearer ${providerConfig.config.apiKey}`
          })
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;

          let parsedLine = line;

          // Handle Server-Sent Events format
          if (line.startsWith('data: ')) {
            parsedLine = line.substring(6);
          }

          if (parsedLine === '[DONE]') {
            continue;
          }

          try {
            const data = JSON.parse(parsedLine);
            let content = '';

            if (providerConfig.type === 'ollama') {
              content = data.message?.content || '';
            } else {
              // OpenAI/LM Studio format
              content = data.choices?.[0]?.delta?.content || '';
            }

            if (content) {
              accumulatedContent += content;

              // Update streaming message
              setStreamingMessages(prev => {
                const updated = new Map(prev);
                const msg = updated.get(messageId);
                if (msg) {
                  msg.streamContent = accumulatedContent;
                  msg.content = accumulatedContent;
                }
                return updated;
              });

              // Callback for chunk
              if (onChunk) {
                onChunk(content);
              }

              // Callback for update
              if (onMessageUpdate) {
                onMessageUpdate(messageId, accumulatedContent);
              }
            }
          } catch (e) {
            // Skip unparseable lines
            console.warn('Failed to parse streaming line:', parsedLine);
          }
        }
      }

      // Mark streaming as complete
      const processingTime = Date.now() - streamController.startTime;

      setStreamingMessages(prev => {
        const updated = new Map(prev);
        const msg = updated.get(messageId);
        if (msg) {
          msg.isStreaming = false;
          msg.content = accumulatedContent;
          msg.metadata = {
            ...msg.metadata,
            processingTime,
            tokenCount: accumulatedContent.split(' ').length
          };
        }
        return updated;
      });

      if (onMessageComplete) {
        onMessageComplete(messageId, accumulatedContent);
      }

    } catch (error: any) {
      console.error('Streaming error:', error);

      // Handle errors
      setStreamingMessages(prev => {
        const updated = new Map(prev);
        const msg = updated.get(messageId);
        if (msg) {
          msg.isStreaming = false;
          msg.error = error.message;
        }
        return updated;
      });

      if (onError) {
        onError(messageId, error.message);
      }
    } finally {
      // Clean up active stream
      setActiveStreams(prev => {
        const updated = new Map(prev);
        updated.delete(messageId);
        return updated;
      });

      // Process queued streams
      processQueue(providerId);
    }
  }, [activeStreams, maxConcurrentStreams, onMessageUpdate, onMessageComplete, onError]);

  // Process queued streams
  const processQueue = useCallback((providerId: string) => {
    const queue = streamQueues.current.get(providerId);
    if (queue && queue.length > 0 && activeStreams.size < maxConcurrentStreams) {
      const nextMessageId = queue.shift();
      if (nextMessageId) {
        // Trigger next stream (would need provider config passed through)
        console.log('Processing queued stream:', nextMessageId);
      }
    }
  }, [activeStreams, maxConcurrentStreams]);

  // Cancel a specific stream
  const cancelStream = useCallback((messageId: string) => {
    const streamController = activeStreams.get(messageId);
    if (streamController) {
      streamController.abortController.abort();

      setStreamingMessages(prev => {
        const updated = new Map(prev);
        const msg = updated.get(messageId);
        if (msg) {
          msg.isStreaming = false;
          msg.error = 'Stream cancelled by user';
        }
        return updated;
      });

      setActiveStreams(prev => {
        const updated = new Map(prev);
        updated.delete(messageId);
        return updated;
      });
    }
  }, [activeStreams]);

  // Cancel all streams
  const cancelAllStreams = useCallback(() => {
    activeStreams.forEach((controller) => {
      controller.abortController.abort();
    });

    setStreamingMessages(prev => {
      const updated = new Map(prev);
      updated.forEach((msg) => {
        if (msg.isStreaming) {
          msg.isStreaming = false;
          msg.error = 'Stream cancelled by user';
        }
      });
      return updated;
    });

    setActiveStreams(new Map());
    streamQueues.current.clear();
  }, [activeStreams]);

  // Get streaming status for a message
  const getStreamingStatus = useCallback((messageId: string) => {
    const msg = streamingMessages.get(messageId);
    return {
      isStreaming: msg?.isStreaming || false,
      content: msg?.streamContent || '',
      error: msg?.error,
      message: msg
    };
  }, [streamingMessages]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAllStreams();
    };
  }, [cancelAllStreams]);

  return {
    startStreaming,
    cancelStream,
    cancelAllStreams,
    getStreamingStatus,
    streamingMessages: Array.from(streamingMessages.values()),
    activeStreamsCount: activeStreams.size,
    isStreaming: activeStreams.size > 0
  };
};