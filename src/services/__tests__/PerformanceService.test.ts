import { Database } from '../../database/Database';
import { QualityFeedbackRepository } from '../../database/QualityFeedbackRepository';
import { PerformanceRepository } from '../../database/PerformanceRepository';
import { PerformanceService } from '../PerformanceService';
import { QualityFeedback, PerformanceMetric } from '../../types/performance';

describe('PerformanceService', () => {
  let db: Database;
  let qualityRepo: QualityFeedbackRepository;
  let perfRepo: PerformanceRepository;
  let service: PerformanceService;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initialize();
    
    // Disable foreign key constraints for testing
    await db.getDatabase().run("PRAGMA foreign_keys = OFF");
    
    qualityRepo = new QualityFeedbackRepository(db);
    perfRepo = new PerformanceRepository(db);
    service = new PerformanceService(qualityRepo, perfRepo);

    // Add test data
    await db.getDatabase().run("INSERT INTO conversations (id, title) VALUES ('conv1', 'test conv')");
    await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp) VALUES ('msg1', 'conv1', 'test', 'user', '2025-09-22T12:00:00.000Z')");
    await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp, task_id) VALUES ('msg2', 'conv1', 'test2', 'user', '2025-09-22T12:01:00.000Z', 'task1')");
  });

  afterEach(async () => {
    await db.close();
  });

  it('should get performance data using getAllFeedback and getByTaskId methods', async () => {
    // Create test performance metrics
    const metric1: PerformanceMetric = {
      id: 'perf1',
      message_id: 'msg1',
      model_id: 'model1',
      processing_time: 100,
      token_count: 50,
      prompt_tokens: 20,
      completion_tokens: 30,
      created_at: new Date(),
    };

    const metric2: PerformanceMetric = {
      id: 'perf2',
      message_id: 'msg2',
      model_id: 'model2',
      processing_time: 200,
      token_count: 75,
      prompt_tokens: 30,
      completion_tokens: 45,
      created_at: new Date(),
    };

    await perfRepo.create(metric1);
    await perfRepo.create(metric2);

    // Create test quality feedback
    const feedback1: QualityFeedback = {
      id: 'feedback1',
      message_id: 'msg1',
      model_id: 'model1',
      user_rating: 5,
      created_at: new Date(),
    };

    const feedback2: QualityFeedback = {
      id: 'feedback2',
      message_id: 'msg2',
      model_id: 'model2',
      user_rating: 3,
      created_at: new Date(),
    };

    await qualityRepo.create(feedback1);
    await qualityRepo.create(feedback2);

    // Test getting all performance data (uses getAllFeedback method)
    const allPerformanceData = await service.getPerformanceData();
    expect(allPerformanceData).toHaveLength(2);
    expect(allPerformanceData.find(d => d.modelId === 'model1')).toBeDefined();
    expect(allPerformanceData.find(d => d.modelId === 'model2')).toBeDefined();

    // Test getting performance data by task ID (uses getByTaskId method)
    const taskPerformanceData = await service.getPerformanceData('task1');
    expect(taskPerformanceData).toHaveLength(1);
    expect(taskPerformanceData[0].modelId).toBe('model2');
  });

  it('should get recommended model for a task', async () => {
    // Create test data for task1
    const metric: PerformanceMetric = {
      id: 'perf1',
      message_id: 'msg2',
      model_id: 'model1',
      processing_time: 100,
      token_count: 50,
      created_at: new Date(),
    };

    const feedback: QualityFeedback = {
      id: 'feedback1',
      message_id: 'msg2',
      model_id: 'model1',
      user_rating: 5,
      created_at: new Date(),
    };

    await perfRepo.create(metric);
    await qualityRepo.create(feedback);

    const recommendedModel = await service.getRecommendedModel('task1');
    expect(recommendedModel).toBe('model1');
  });
});