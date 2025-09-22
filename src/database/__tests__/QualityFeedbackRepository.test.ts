import { Database } from '../Database';
import { QualityFeedbackRepository } from '../QualityFeedbackRepository';
import { QualityFeedback } from '../../types/performance';

describe('QualityFeedbackRepository', () => {
  let db: Database;
  let repo: QualityFeedbackRepository;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initialize();
    repo = new QualityFeedbackRepository(db);

    // Disable foreign key constraints for testing
    await db.getDatabase().run("PRAGMA foreign_keys = OFF");

    // Add a dummy conversation and message for foreign key constraints
    await db.getDatabase().run("INSERT INTO conversations (id, title) VALUES ('conv1', 'test conv')");
    await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp) VALUES ('msg1', 'conv1', 'test', 'user', '2025-09-22T12:00:00.000Z')");
  });

  afterEach(async () => {
    await db.close();
  });

  it('should create and get quality feedback', async () => {
    const feedback: QualityFeedback = {
      id: 'feedback1',
      message_id: 'msg1',
      model_id: 'model1',
      user_rating: 5,
      accuracy: 0.9,
      helpfulness: 0.8,
      relevance: 0.95,
      completeness: 0.85,
      feedback_text: 'Great response',
      created_at: new Date(),
    };

    await repo.create(feedback);

    const feedbacks = await repo.getByMessageId('msg1');
    expect(feedbacks).toHaveLength(1);
    expect(feedbacks[0].id).toBe('feedback1');
    expect(feedbacks[0].user_rating).toBe(5);
  });

  it('should get all quality feedback', async () => {
    // Add another message for testing
    await db.getDatabase().run("INSERT INTO messages (id, conversation_id, content, sender, timestamp) VALUES ('msg2', 'conv1', 'test2', 'user', '2025-09-22T12:01:00.000Z')");

    const feedback1: QualityFeedback = {
      id: 'feedback2',
      message_id: 'msg2',
      model_id: 'model2',
      user_rating: 3,
      created_at: new Date(),
    };

    const feedback2: QualityFeedback = {
      id: 'feedback3',
      message_id: 'msg2',
      model_id: 'model3',
      user_rating: 4,
      feedback_text: 'Good response',
      created_at: new Date(),
    };

    await repo.create(feedback1);
    await repo.create(feedback2);

    const allFeedback = await repo.getAllFeedback();
    expect(allFeedback.length).toBe(2); // Only the 2 we created in this test
    
    // Check that all our feedback records are present
    const feedbackIds = allFeedback.map(f => f.id);
    expect(feedbackIds).toContain('feedback2');
    expect(feedbackIds).toContain('feedback3');
  });

  it('should handle errors when getting all feedback', async () => {
    // Close the database to simulate an error
    await db.close();
    
    // The Database class throws "Database not initialized" when closed
    await expect(repo.getAllFeedback()).rejects.toThrow('Database not initialized');
  });
});
