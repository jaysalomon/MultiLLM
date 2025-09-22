import { Database } from '../Database';
import { PerformanceRepository } from '../PerformanceRepository';
import { PerformanceMetric } from '../../types/performance';

describe('PerformanceRepository', () => {
  let db: Database;
  let repo: PerformanceRepository;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initialize();
    repo = new PerformanceRepository(db);

    // Disable foreign key constraints for testing
    await db.getDatabase().run("PRAGMA foreign_keys = OFF");

    // Add dummy data for foreign key constraints
    await db.getDatabase().run("INSERT INTO conversations (id, title) VALUES ('conv1', 'test conv')");
    await db.getDatabase().run("INSERT INTO tasks (id, name) VALUES ('task1', 'Test Task 1')");
    await db.getDatabase().run("INSERT INTO tasks (id, name) VALUES ('task2', 'Test Task 2')");
    await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp) VALUES ('msg1', 'conv1', 'test', 'user', '2025-09-22T12:00:00.000Z')");
  });

  afterEach(async () => {
    await db.close();
  });

  it('should create and get performance metrics', async () => {
    const metric: PerformanceMetric = {
      id: 'perf1',
      message_id: 'msg1',
      model_id: 'model1',
      processing_time: 100,
      token_count: 50,
      prompt_tokens: 20,
      completion_tokens: 30,
      created_at: new Date(),
    };

    await repo.create(metric);

    const metrics = await repo.getByMessageId('msg1');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].id).toBe('perf1');
    expect(metrics[0].processing_time).toBe(100);
  });

  it('should get performance metrics by task ID', async () => {
    try {
      // Add messages with task_id for testing
      await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp, task_id) VALUES ('msg_task1', 'conv1', 'task message 1', 'user', '2025-09-22T12:02:00.000Z', 'task1')");
      await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp, task_id) VALUES ('msg_task2', 'conv1', 'task message 2', 'user', '2025-09-22T12:03:00.000Z', 'task1')");
      await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp, task_id) VALUES ('msg_task3', 'conv1', 'task message 3', 'user', '2025-09-22T12:04:00.000Z', 'task2')");

      const metric1: PerformanceMetric = {
        id: 'perf_task1',
        message_id: 'msg_task1',
        model_id: 'model1',
        processing_time: 150,
        token_count: 75,
        created_at: new Date(),
      };

      const metric2: PerformanceMetric = {
        id: 'perf_task2',
        message_id: 'msg_task2',
        model_id: 'model2',
        processing_time: 200,
        token_count: 100,
        created_at: new Date(),
      };

      const metric3: PerformanceMetric = {
        id: 'perf_task3',
        message_id: 'msg_task3',
        model_id: 'model1',
        processing_time: 120,
        token_count: 60,
        created_at: new Date(),
      };

      await repo.create(metric1);
      await repo.create(metric2);
      await repo.create(metric3);

      // Get metrics for task1 - should return 2 metrics
      const task1Metrics = await repo.getByTaskId('task1');
      expect(task1Metrics).toHaveLength(2);
      expect(task1Metrics.map(m => m.id)).toContain('perf_task1');
      expect(task1Metrics.map(m => m.id)).toContain('perf_task2');

      // Get metrics for task2 - should return 1 metric
      const task2Metrics = await repo.getByTaskId('task2');
      expect(task2Metrics).toHaveLength(1);
      expect(task2Metrics[0].id).toBe('perf_task3');

      // Get metrics for non-existent task - should return empty array
      const noTaskMetrics = await repo.getByTaskId('nonexistent');
      expect(noTaskMetrics).toHaveLength(0);
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });

  it('should handle errors when getting metrics by task ID', async () => {
    // Test with empty task ID
    await expect(repo.getByTaskId('')).rejects.toThrow('Task ID is required');
    
    // Close the database to simulate an error
    await db.close();
    
    // The Database class throws "Database not initialized" when closed
    await expect(repo.getByTaskId('task1')).rejects.toThrow('Database not initialized');
  });
});
