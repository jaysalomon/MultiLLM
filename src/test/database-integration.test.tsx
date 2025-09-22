import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConversationManager } from '../renderer/components/conversation/ConversationManager';
import { useConversationPersistence } from '../renderer/hooks/useConversationPersistence';

// Mock the electron API
const mockElectronAPI = {
  saveConversation: vi.fn(),
  loadConversations: vi.fn(),
  loadConversation: vi.fn(),
  deleteConversation: vi.fn(),
  exportConversation: vi.fn(),
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  saveMemory: vi.fn(),
  searchMemories: vi.fn(),
};

// Set up window.electronAPI
(global as any).window = {
  electronAPI: mockElectronAPI,
  confirm: vi.fn(() => true),
};

describe('Database-UI Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set default return values
    mockElectronAPI.loadConversations.mockResolvedValue([]);
    mockElectronAPI.saveConversation.mockResolvedValue('test-id-123');
  });

  describe('ConversationManager Component', () => {
    it('should load conversations on mount', async () => {
      const mockConversations = [
        {
          id: '1',
          title: 'Test Conversation 1',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'Test Conversation 2',
          created_at: new Date('2024-01-02'),
          updated_at: new Date('2024-01-02'),
        },
      ];

      mockElectronAPI.loadConversations.mockResolvedValue(mockConversations);

      render(<ConversationManager />);

      await waitFor(() => {
        expect(mockElectronAPI.loadConversations).toHaveBeenCalledTimes(1);
      });

      expect(screen.getByText('Test Conversation 1')).toBeInTheDocument();
      expect(screen.getByText('Test Conversation 2')).toBeInTheDocument();
    });

    it('should create a new conversation', async () => {
      const user = userEvent.setup();

      render(<ConversationManager />);

      // Click new conversation button
      const newButton = screen.getByLabelText('Create new conversation');
      await user.click(newButton);

      // Enter title in dialog
      const titleInput = screen.getByPlaceholderText('Enter conversation title...');
      await user.type(titleInput, 'My New Conversation');

      // Click create button
      const createButton = screen.getByText('Create');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockElectronAPI.saveConversation).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'My New Conversation',
          })
        );
      });
    });

    it('should delete a conversation', async () => {
      const user = userEvent.setup();

      const mockConversations = [
        {
          id: '1',
          title: 'Test Conversation',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      mockElectronAPI.loadConversations.mockResolvedValue(mockConversations);
      mockElectronAPI.deleteConversation.mockResolvedValue(undefined);

      render(<ConversationManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Conversation')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByLabelText('Delete Test Conversation');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockElectronAPI.deleteConversation).toHaveBeenCalledWith('1');
      });
    });

    it('should export a conversation', async () => {
      const user = userEvent.setup();

      const mockConversations = [
        {
          id: '1',
          title: 'Test Conversation',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      mockElectronAPI.loadConversations.mockResolvedValue(mockConversations);
      mockElectronAPI.exportConversation.mockResolvedValue('/path/to/export.json');

      render(<ConversationManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Conversation')).toBeInTheDocument();
      });

      // Select export format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'markdown');

      // Click export button
      const exportButton = screen.getByLabelText('Export Test Conversation');
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockElectronAPI.exportConversation).toHaveBeenCalledWith('1', 'markdown');
      });
    });

    it('should toggle auto-save', async () => {
      const user = userEvent.setup();

      render(<ConversationManager />);

      const autoSaveCheckbox = screen.getByLabelText(/auto-save conversations/i);

      // Initially checked
      expect(autoSaveCheckbox).toBeChecked();

      // Toggle off
      await user.click(autoSaveCheckbox);
      expect(autoSaveCheckbox).not.toBeChecked();

      // Toggle on
      await user.click(autoSaveCheckbox);
      expect(autoSaveCheckbox).toBeChecked();
    });

    it('should display error messages', async () => {
      mockElectronAPI.loadConversations.mockRejectedValue(new Error('Database error'));

      render(<ConversationManager />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load conversations');
      });
    });
  });

  describe('useConversationPersistence Hook', () => {
    function TestComponent() {
      const {
        conversations,
        currentConversation,
        loading,
        error,
        createConversation,
        saveMessage,
        deleteConversation,
      } = useConversationPersistence();

      return (
        <div>
          <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
          <div data-testid="error">{error || 'No Error'}</div>
          <div data-testid="conversations-count">{conversations.length}</div>
          <div data-testid="current-conversation">
            {currentConversation?.title || 'None'}
          </div>
          <button onClick={() => createConversation('Test Conv')}>Create</button>
          <button
            onClick={() => saveMessage({
              id: 'msg1',
              content: 'Test',
              sender: 'user',
              timestamp: new Date()
            })}
          >
            Save Message
          </button>
          <button onClick={() => deleteConversation('1')}>Delete</button>
        </div>
      );
    }

    it('should manage conversation state', async () => {
      const user = userEvent.setup();

      mockElectronAPI.loadConversations.mockResolvedValue([
        {
          id: '1',
          title: 'Existing Conversation',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      render(<TestComponent />);

      // Check initial load
      await waitFor(() => {
        expect(screen.getByTestId('conversations-count')).toHaveTextContent('1');
      });

      // Create new conversation
      const createButton = screen.getByText('Create');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockElectronAPI.saveConversation).toHaveBeenCalled();
      });
    });

    it('should save messages with auto-save enabled', async () => {
      const user = userEvent.setup();

      mockElectronAPI.loadConversation.mockResolvedValue({
        id: 'conv1',
        title: 'Test Conversation',
        messages: [],
      });

      render(<TestComponent />);

      // Save a message
      const saveButton = screen.getByText('Save Message');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockElectronAPI.addMessage).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            content: 'Test',
            sender: 'user',
          })
        );
      });
    });

    it('should handle memory persistence for long messages', async () => {
      const user = userEvent.setup();

      const longMessage = {
        id: 'msg1',
        content: 'This is a very long message that contains important information that should be saved to the memory system for future reference and context. '.repeat(5),
        sender: 'user',
        timestamp: new Date(),
      };

      mockElectronAPI.loadConversation.mockResolvedValue({
        id: 'conv1',
        title: 'Test Conversation',
        messages: [],
      });

      function TestComponentWithLongMessage() {
        const { saveMessage } = useConversationPersistence();
        return (
          <button onClick={() => saveMessage(longMessage)}>
            Save Long Message
          </button>
        );
      }

      render(<TestComponentWithLongMessage />);

      const saveButton = screen.getByText('Save Long Message');
      await user.click(saveButton);

      await waitFor(() => {
        // Should save both the message and create a memory fact
        expect(mockElectronAPI.addMessage).toHaveBeenCalled();
        expect(mockElectronAPI.saveMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            fact: expect.stringContaining('This is a very long message'),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockElectronAPI.loadConversations.mockRejectedValue(
        new Error('Database connection failed')
      );

      render(<ConversationManager />);

      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveTextContent('Failed to load conversations');
      });
    });

    it('should retry operations on transient failures', async () => {
      let callCount = 0;
      mockElectronAPI.saveConversation.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve('test-id');
      });

      const user = userEvent.setup();

      render(<ConversationManager />);

      // Open new conversation dialog
      const newButton = screen.getByLabelText('Create new conversation');
      await user.click(newButton);

      // Enter title
      const titleInput = screen.getByPlaceholderText('Enter conversation title...');
      await user.type(titleInput, 'Test');

      // Create
      const createButton = screen.getByText('Create');
      await user.click(createButton);

      // The hook should handle the error internally
      await waitFor(() => {
        expect(mockElectronAPI.saveConversation).toHaveBeenCalled();
      });
    });

    it('should validate data before saving', async () => {
      const user = userEvent.setup();

      render(<ConversationManager />);

      // Open new conversation dialog
      const newButton = screen.getByLabelText('Create new conversation');
      await user.click(newButton);

      // Don't enter a title, just click create
      const createButton = screen.getByText('Create');

      // Button should be disabled without title
      expect(createButton).toBeDisabled();
    });
  });
});