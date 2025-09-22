import React, { useEffect, useState, useCallback } from 'react';
import { TaskManagementProps, Task } from '../../types/performance';
import { ErrorBoundary, ErrorDisplay, EmptyState } from '../common/ErrorBoundary';
import { Spinner, SkeletonLoader } from '../common/LoadingStates';
import './TaskManagement.css';

/**
 * Task management component for performance dashboard
 * Requirements: 11.4, 11.5
 */
export const TaskManagement: React.FC<TaskManagementProps> = ({
  tasks: propTasks,
  selectedTaskId,
  isLoading = false,
  error,
  onTaskSelect,
  onTaskCreate,
  onTaskDelete,
  onTaskUpdate
}) => {
  const [tasks, setTasks] = useState<Task[]>(propTasks || []);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Fetch tasks if not provided via props
  useEffect(() => {
    if (!propTasks) {
      fetchTasks();
    } else {
      setTasks(propTasks);
    }
  }, [propTasks]);

  const fetchTasks = useCallback(async () => {
    try {
      setLocalError(null);
      if (typeof window !== 'undefined' && window.electronAPI) {
        const taskList = await window.electronAPI.getTasks();
        setTasks(taskList);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    }
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (newTaskName.trim() === '') {
      setLocalError('Task name is required');
      return;
    }

    setIsCreating(true);
    setLocalError(null);

    try {
      if (onTaskCreate) {
        await onTaskCreate(newTaskName.trim(), newTaskDescription.trim() || undefined);
      } else if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.createTask(newTaskName.trim(), newTaskDescription.trim());
        await fetchTasks();
      }

      setNewTaskName('');
      setNewTaskDescription('');
      setShowCreateForm(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  }, [newTaskName, newTaskDescription, onTaskCreate, fetchTasks]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      setLocalError(null);
      if (onTaskDelete) {
        await onTaskDelete(taskId);
      } else {
        // Implement delete via electron API if available
        setTasks(prev => prev.filter(task => task.id !== taskId));
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }, [onTaskDelete]);

  const handleEditTask = useCallback(async (taskId: string) => {
    if (editName.trim() === '') {
      setLocalError('Task name is required');
      return;
    }

    try {
      setLocalError(null);
      const updates: Partial<Task> = {
        name: editName.trim(),
        description: editDescription.trim() || undefined
      };

      if (onTaskUpdate) {
        await onTaskUpdate(taskId, updates);
      } else {
        // Update local state
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
        ));
      }

      setEditingTask(null);
      setEditName('');
      setEditDescription('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update task');
    }
  }, [editName, editDescription, onTaskUpdate]);

  const startEditing = useCallback((task: Task) => {
    setEditingTask(task.id);
    setEditName(task.name);
    setEditDescription(task.description || '');
    setLocalError(null);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTask(null);
    setEditName('');
    setEditDescription('');
    setLocalError(null);
  }, []);

  const handleTaskSelect = useCallback((taskId: string) => {
    if (onTaskSelect) {
      onTaskSelect(taskId);
    }
  }, [onTaskSelect]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      action();
    } else if (event.key === 'Escape') {
      if (editingTask) {
        cancelEditing();
      } else if (showCreateForm) {
        setShowCreateForm(false);
        setNewTaskName('');
        setNewTaskDescription('');
      }
    }
  }, [editingTask, showCreateForm, cancelEditing]);

  const displayError = error || localError;

  if (displayError) {
    return (
      <ErrorBoundary>
        <div className="task-management">
          <div className="task-management-header">
            <h3>Task Management</h3>
          </div>
          <ErrorDisplay
            error={displayError}
            title="Task Management Error"
            variant="card"
            onRetry={fetchTasks}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="task-management">
        <div className="task-management-header">
          <h3>Task Management</h3>
          <button
            className="create-task-button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={isLoading}
            aria-label="Create new task"
          >
            {showCreateForm ? '✕ Cancel' : '+ New Task'}
          </button>
        </div>

        {showCreateForm && (
          <div className="task-creator">
            <div className="task-creator-header">
              <h4>Create New Task</h4>
            </div>
            <div className="task-creator-form">
              <div className="form-group">
                <label htmlFor="new-task-name">Task Name *</label>
                <input
                  id="new-task-name"
                  type="text"
                  placeholder="Enter task name..."
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleCreateTask)}
                  disabled={isCreating}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-task-description">Description</label>
                <textarea
                  id="new-task-description"
                  placeholder="Enter task description (optional)..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleCreateTask)}
                  disabled={isCreating}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button
                  onClick={handleCreateTask}
                  disabled={isCreating || !newTaskName.trim()}
                  className="create-button primary"
                >
                  {isCreating ? <Spinner size="small" /> : 'Create Task'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTaskName('');
                    setNewTaskDescription('');
                  }}
                  disabled={isCreating}
                  className="cancel-button secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="task-list-container">
          {isLoading ? (
            <div className="task-list-loading">
              <SkeletonLoader lines={3} showTitle={true} />
              <SkeletonLoader lines={2} showTitle={true} />
              <SkeletonLoader lines={4} showTitle={true} />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              title="No Tasks Created"
              description="Create your first task to start tracking performance metrics by task type."
              icon="📋"
              action={{
                label: "Create Task",
                onClick: () => setShowCreateForm(true)
              }}
            />
          ) : (
            <div className="task-list" role="list">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`task-item ${selectedTaskId === task.id ? 'selected' : ''}`}
                  role="listitem"
                >
                  {editingTask === task.id ? (
                    <div className="task-edit-form">
                      <div className="form-group">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleEditTask(task.id))}
                          placeholder="Task name..."
                          autoFocus
                        />
                      </div>
                      <div className="form-group">
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, () => handleEditTask(task.id))}
                          placeholder="Task description..."
                          rows={2}
                        />
                      </div>
                      <div className="task-edit-actions">
                        <button
                          onClick={() => handleEditTask(task.id)}
                          disabled={!editName.trim()}
                          className="save-button primary"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="cancel-button secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="task-content">
                      <div className="task-info">
                        <h4 className="task-name">{task.name}</h4>
                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}
                      </div>
                      <div className="task-actions">
                        {onTaskSelect && (
                          <button
                            onClick={() => handleTaskSelect(task.id)}
                            className={`select-button ${selectedTaskId === task.id ? 'selected' : ''}`}
                            aria-label={`${selectedTaskId === task.id ? 'Deselect' : 'Select'} task ${task.name}`}
                          >
                            {selectedTaskId === task.id ? '✓ Selected' : 'Select'}
                          </button>
                        )}
                        <button
                          onClick={() => startEditing(task)}
                          className="edit-button"
                          aria-label={`Edit task ${task.name}`}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="delete-button"
                          aria-label={`Delete task ${task.name}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};
