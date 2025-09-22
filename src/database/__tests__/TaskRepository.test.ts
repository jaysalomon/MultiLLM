import { Database } from '../Database';
import { TaskRepository } from '../TaskRepository';
import { Task } from '../../types/performance';

describe('TaskRepository', () => {
  let db: Database;
  let repo: TaskRepository;

  beforeAll(async () => {
    db = new Database(':memory:');
    await db.initialize();
    repo = new TaskRepository(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('should create and list tasks', async () => {
    const task: Task = {
      id: 'task1',
      name: 'test task',
      description: 'a task for testing',
    };

    await repo.create(task);

    const tasks = await repo.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task1');
  });
});
