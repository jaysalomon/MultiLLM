import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskManagement } from '../TaskManagement';
import { Task } from '../../../types/performance';

// Mock CSS imports
vi.mock('../TaskManagement.css', () => ({}));
vi.mock('../../common/ErrorBoundary.css', () => ({}));
vi.mock('../../common/LoadingStates.css', () => ({}));

describe('TaskManagement', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      name: 'Code Review',
      description: 'Review code changes'
    },
    {
      id: '2',
      name: 'Documentation',
      description: 'Write documentation'
    }
  ];

  it('renders task list', () => {
    render(<TaskManagement tasks={mockTasks} />);

    expect(screen.getByText('Task Management')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(<TaskManagement tasks={[]} />);

    expect(screen.getByText('No Tasks Created')).toBeInTheDocument();
    expect(screen.getByText('Create your first task to start tracking performance metrics by task type.')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TaskManagement tasks={[]} isLoading={true} />);

    expect(screen.getByText('Task Management')).toBeInTheDocument();
    // When loading, the create button should be disabled
    expect(screen.getByText('+ New Task')).toBeDisabled();
  });

  it('shows error state', () => {
    render(<TaskManagement error="Failed to load tasks" />);

    expect(screen.getByText('Task Management Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
  });

  it('opens create task form', async () => {
    const user = userEvent.setup();
    render(<TaskManagement tasks={[]} />);

    await user.click(screen.getByText('+ New Task'));

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter task name...')).toBeInTheDocument();
  });

  it('creates new task', async () => {
    const user = userEvent.setup();
    const onTaskCreate = vi.fn();
    render(<TaskManagement tasks={[]} onTaskCreate={onTaskCreate} />);

    await user.click(screen.getByText('+ New Task'));
    await user.type(screen.getByPlaceholderText('Enter task name...'), 'New Task');
    await user.type(screen.getByPlaceholderText('Enter task description (optional)...'), 'Task description');
    
    // Use a more specific selector for the form's create button
    const formCreateButton = document.querySelector('.form-actions .create-button');
    expect(formCreateButton).toBeInTheDocument();
    await user.click(formCreateButton as HTMLElement);

    await waitFor(() => {
      expect(onTaskCreate).toHaveBeenCalledWith('New Task', 'Task description');
    });
  });

  it('selects task', async () => {
    const user = userEvent.setup();
    const onTaskSelect = vi.fn();
    render(<TaskManagement tasks={mockTasks} onTaskSelect={onTaskSelect} />);

    await user.click(screen.getAllByText('Select')[0]);

    expect(onTaskSelect).toHaveBeenCalledWith('1');
  });

  it('shows selected task', () => {
    const onTaskSelect = vi.fn();
    render(<TaskManagement tasks={mockTasks} selectedTaskId="1" onTaskSelect={onTaskSelect} />);

    expect(screen.getByText('✓ Selected')).toBeInTheDocument();
  });
});