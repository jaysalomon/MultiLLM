import { Database } from './Database';
import { Task } from '../types/performance';

/**
 * Repository for tasks
 * Requirements: 11.5
 */
export class TaskRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new task
   */
  async create(task: Task): Promise<void> {
    const query = `
      INSERT INTO tasks (id, name, description)
      VALUES (?, ?, ?)
    `;
    await this.db['executeQuery'](query, [task.id, task.name, task.description]);
  }

  /**
   * Get a task by ID
   */
  async get(id: string): Promise<Task> {
    const query = 'SELECT * FROM tasks WHERE id = ?';
    return this.db['executeQuery'](query, [id], 'get');
  }

  /**
   * List all tasks
   */
  async list(): Promise<Task[]> {
    const query = 'SELECT * FROM tasks';
    return this.db['executeQuery'](query, [], 'all');
  }
}
