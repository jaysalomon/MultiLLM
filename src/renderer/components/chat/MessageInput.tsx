import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../../types/performance';
import { ModelRecommendation } from './ModelRecommendation';
import './MessageInput.css';

interface MessageInputProps {
  onSendMessage: (message: string, taskId?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message..."
}) => {
  const [message, setMessage] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      const taskList = await window.electronAPI.getTasks();
      setTasks(taskList);
    };
    fetchTasks();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), selectedTask);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div className="message-input-container" role="region" aria-label="Message composition">
      <form onSubmit={handleSubmit} className="message-input-form" aria-label="Compose message">
        <div className="input-wrapper">
          <select 
            className="task-select"
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
          >
            <option value="">No Task</option>
            {tasks.map(task => (
              <option key={task.id} value={task.id}>{task.name}</option>
            ))}
          </select>
          <ModelRecommendation taskId={selectedTask} />
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="message-textarea"
            rows={1}
            maxLength={4000}
            aria-label="Message input"
            aria-describedby="input-hint character-limit"
            aria-invalid={message.length > 4000}
          />
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="send-button"
            aria-label="Send message"
            title="Send message (Enter)"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        </div>
        <div className="input-footer">
          <span id="character-limit" className="character-count" role="status" aria-live="polite" aria-atomic="true">
            {message.length}/4000 characters
          </span>
          <span id="input-hint" className="input-hint">
            Press Enter to send, Shift+Enter for new line
          </span>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;