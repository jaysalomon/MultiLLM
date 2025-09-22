import { useState, useEffect, useCallback } from 'react';
import { ChatMessage } from '../../types/chat';
import { v4 as uuidv4 } from 'uuid';

interface Conversation {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  summary?: string;
  participants?: string[];
  messages?: ChatMessage[];
}

interface UseConversationPersistenceReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loading: boolean;
  error: string | null;
  createConversation: (title: string) => Promise<string>;
  loadConversation: (id: string) => Promise<void>;
  saveMessage: (message: ChatMessage) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  exportConversation: (id: string, format: 'json' | 'markdown' | 'text') => Promise<void>;
  refreshConversations: () => Promise<void>;
  autoSave: boolean;
  setAutoSave: (enabled: boolean) => void;
}

export const useConversationPersistence = (): UseConversationPersistenceReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState(true);

  // Load all conversations on mount
  useEffect(() => {
    refreshConversations();
  }, []);

  const refreshConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedConversations = await window.electronAPI.loadConversations();
      setConversations(loadedConversations || []);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (title: string): Promise<string> => {
    const conversation: Conversation = {
      id: uuidv4(),
      title: title || `Conversation ${new Date().toLocaleString()}`,
      created_at: new Date(),
      updated_at: new Date(),
      messages: [],
      participants: []
    };

    try {
      const id = await window.electronAPI.saveConversation(conversation);
      setCurrentConversation({ ...conversation, id });
      await refreshConversations();
      return id;
    } catch (err) {
      setError('Failed to create conversation');
      console.error('Failed to create conversation:', err);
      throw err;
    }
  }, [refreshConversations]);

  const loadConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const conversation = await window.electronAPI.loadConversation(id);
      setCurrentConversation(conversation);
    } catch (err) {
      setError('Failed to load conversation');
      console.error('Failed to load conversation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveMessage = useCallback(async (message: ChatMessage) => {
    if (!currentConversation || !autoSave) return;

    try {
      await window.electronAPI.addMessage(currentConversation.id, message);

      // Update local state
      setCurrentConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...(prev.messages || []), message],
          updated_at: new Date()
        };
      });

      // Save memory facts from the message if it contains important information
      if (message.content && message.content.length > 50) {
        const memoryFact = {
          id: uuidv4(),
          conversation_id: currentConversation.id,
          fact: message.content.substring(0, 500), // Store first 500 chars as fact
          importance: 0.5,
          created_at: new Date(),
          embedding: [] // Will be computed by the memory system
        };

        try {
          await window.electronAPI.saveMemory(memoryFact);
        } catch (err) {
          console.error('Failed to save memory fact:', err);
          // Don't fail the message save if memory save fails
        }
      }
    } catch (err) {
      setError('Failed to save message');
      console.error('Failed to save message:', err);
      throw err;
    }
  }, [currentConversation, autoSave]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteConversation(id);

      // If deleting the current conversation, clear it
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
      }

      await refreshConversations();
    } catch (err) {
      setError('Failed to delete conversation');
      console.error('Failed to delete conversation:', err);
      throw err;
    }
  }, [currentConversation, refreshConversations]);

  const exportConversation = useCallback(async (id: string, format: 'json' | 'markdown' | 'text') => {
    try {
      await window.electronAPI.exportConversation(id, format);
    } catch (err) {
      setError('Failed to export conversation');
      console.error('Failed to export conversation:', err);
      throw err;
    }
  }, []);

  return {
    conversations,
    currentConversation,
    loading,
    error,
    createConversation,
    loadConversation,
    saveMessage,
    deleteConversation,
    exportConversation,
    refreshConversations,
    autoSave,
    setAutoSave
  };
};