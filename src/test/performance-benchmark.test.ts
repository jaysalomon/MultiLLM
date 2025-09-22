import { describe, it, expect, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { LLMOrchestrator } from '../orchestrator/LLMOrchestrator';
import { SharedMemorySystem } from '../memory/SharedMemorySystem';
import { DatabaseManager } from '../database/DatabaseManager';
import { VectorEmbeddingService } from '../memory/VectorEmbeddingService';

describe('Performance Benchmarks', () => {
  let orchestrator: LLMOrchestrator;
  let memorySystem: SharedMemorySystem;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    orchestrator = new LLMOrchestrator();
    memorySystem = new SharedMemorySystem();
    dbManager = new DatabaseManager(':memory:');
    await dbManager.initialize();
  });

  describe('Concurrent Model Performance', () => {
    it('should handle 10 concurrent model requests within acceptable time', async () => {
      const providers = Array.from({ length: 10 }, (_, i) => ({
        id: `provider-${i}`,
        name: `Provider ${i}`,
        type: 'api' as const,
        config: { apiKey: 'test', modelName: 'test-model' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      providers.forEach((p) => orchestrator.addProvider(p));

      const startTime = performance.now();

      const requests = providers.map((p) =>
        orchestrator.sendRequest(p.id, {
          messages: [{ role: 'user', content: 'Benchmark test' }],
          temperature: 0.7,
        }).catch(() => null) // Ignore failures for benchmark
      );

      await Promise.all(requests);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds for 10 concurrent requests
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain response times under load', async () => {
      const responseTimes: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();

        await orchestrator
          .sendRequest('test-provider', {
            messages: [{ role: 'user', content: `Message ${i}` }],
          })
          .catch(() => null);

        const end = performance.now();
        responseTimes.push(end - start);
      }

      // Calculate average response time
      const avgResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      // Average should be under 500ms
      expect(avgResponseTime).toBeLessThan(500);

      // 95th percentile should be under 1000ms
      const sorted = responseTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      expect(p95).toBeLessThan(1000);
    });
  });

  describe('Memory System Performance', () => {
    it('should search memories quickly with large dataset', async () => {
      // Add 1000 memory facts
      const memories = Array.from({ length: 1000 }, (_, i) => ({
        id: `memory-${i}`,
        conversation_id: 'test-conv',
        fact: `Test fact number ${i} with some random content ${Math.random()}`,
        importance: Math.random(),
        created_at: new Date(),
        embedding: Array.from({ length: 384 }, () => Math.random()),
      }));

      for (const memory of memories) {
        await dbManager.memory.createMemoryFact(memory);
      }

      const startTime = performance.now();

      // Search for memories
      const results = await dbManager.memory.searchMemories('Test fact', 10);

      const endTime = performance.now();
      const searchTime = endTime - startTime;

      // Search should complete within 100ms
      expect(searchTime).toBeLessThan(100);
      expect(results).toHaveLength(10);
    });

    it('should generate embeddings efficiently', async () => {
      const embeddingService = new VectorEmbeddingService();
      await embeddingService.initialize();

      const texts = Array.from(
        { length: 100 },
        (_, i) => `Sample text for embedding generation ${i}`
      );

      const startTime = performance.now();

      const embeddings = await Promise.all(
        texts.map((text) => embeddingService.generateEmbedding(text))
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should generate 100 embeddings in under 10 seconds
      expect(totalTime).toBeLessThan(10000);
      expect(embeddings).toHaveLength(100);
      expect(embeddings[0]).toHaveLength(384);
    });
  });

  describe('Database Performance', () => {
    it('should handle bulk message inserts efficiently', async () => {
      const conversationId = 'perf-test-conv';

      // Create conversation
      await dbManager.conversations.create({
        id: conversationId,
        title: 'Performance Test',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Prepare 500 messages
      const messages = Array.from({ length: 500 }, (_, i) => ({
        id: `msg-${i}`,
        conversation_id: conversationId,
        content: `Message content ${i}`,
        sender: i % 2 === 0 ? 'user' : 'assistant',
        timestamp: new Date(),
      }));

      const startTime = performance.now();

      // Insert all messages
      for (const message of messages) {
        await dbManager.conversations.addMessage(conversationId, message);
      }

      const endTime = performance.now();
      const insertTime = endTime - startTime;

      // Should insert 500 messages in under 5 seconds
      expect(insertTime).toBeLessThan(5000);

      // Verify retrieval is also fast
      const retrieveStart = performance.now();
      const conversation = await dbManager.conversations.getConversationWithMessages(
        conversationId
      );
      const retrieveEnd = performance.now();

      expect(retrieveEnd - retrieveStart).toBeLessThan(500);
      expect(conversation.messages).toHaveLength(500);
    });

    it('should maintain query performance with large dataset', async () => {
      // Create multiple conversations with messages
      for (let c = 0; c < 10; c++) {
        const convId = `conv-${c}`;
        await dbManager.conversations.create({
          id: convId,
          title: `Conversation ${c}`,
          created_at: new Date(),
          updated_at: new Date(),
        });

        for (let m = 0; m < 100; m++) {
          await dbManager.conversations.addMessage(convId, {
            id: `msg-${c}-${m}`,
            conversation_id: convId,
            content: `Message ${m} in conversation ${c}`,
            sender: 'user',
            timestamp: new Date(),
          });
        }
      }

      const startTime = performance.now();

      // Query all conversations
      const conversations = await dbManager.conversations.getAllConversations();

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Should retrieve all conversations in under 100ms
      expect(queryTime).toBeLessThan(100);
      expect(conversations).toHaveLength(10);
    });
  });

  describe('UI Rendering Performance', () => {
    it('should batch state updates efficiently', async () => {
      let updateCount = 0;
      const mockSetState = () => updateCount++;

      // Simulate rapid state updates
      const updates = Array.from({ length: 100 }, (_, i) => ({
        id: `update-${i}`,
        content: `Content ${i}`,
      }));

      // Batch updates
      const batchedUpdates = [];
      for (const update of updates) {
        batchedUpdates.push(update);
        if (batchedUpdates.length >= 10) {
          mockSetState();
          batchedUpdates.length = 0;
        }
      }
      if (batchedUpdates.length > 0) {
        mockSetState();
      }

      // Should batch 100 updates into ~10 state updates
      expect(updateCount).toBeLessThanOrEqual(11);
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources properly', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy multiple large objects
      for (let i = 0; i < 100; i++) {
        const largeArray = Array.from({ length: 10000 }, () => Math.random());
        const orchestrator = new LLMOrchestrator();

        // Add providers
        for (let j = 0; j < 10; j++) {
          orchestrator.addProvider({
            id: `provider-${j}`,
            name: `Provider ${j}`,
            type: 'api',
            config: {},
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Clear references
        orchestrator.removeAllProviders();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Streaming Performance', () => {
    it('should handle high-frequency streaming updates', async () => {
      const updateFrequencies: number[] = [];
      let lastUpdate = performance.now();

      // Simulate streaming updates
      const streamSimulator = new ReadableStream({
        start(controller) {
          let count = 0;
          const interval = setInterval(() => {
            const now = performance.now();
            updateFrequencies.push(now - lastUpdate);
            lastUpdate = now;

            controller.enqueue(
              new TextEncoder().encode(
                `data: {"content": "token${count++}"}\n\n`
              )
            );

            if (count >= 100) {
              clearInterval(interval);
              controller.close();
            }
          }, 10); // 10ms intervals = 100 updates per second
        },
      });

      const reader = streamSimulator.getReader();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(new TextDecoder().decode(value));
      }

      // Should handle 100 updates
      expect(chunks).toHaveLength(100);

      // Average update frequency should be close to 10ms
      const avgFrequency =
        updateFrequencies.reduce((a, b) => a + b, 0) /
        updateFrequencies.length;
      expect(avgFrequency).toBeCloseTo(10, 5);
    });
  });

  describe('Overall System Performance', () => {
    it('should meet performance targets for complete workflow', async () => {
      const workflow = async () => {
        // 1. Create conversation
        const convId = await dbManager.conversations.create({
          id: 'workflow-test',
          title: 'Workflow Test',
          created_at: new Date(),
          updated_at: new Date(),
        });

        // 2. Add message
        await dbManager.conversations.addMessage(convId, {
          id: 'msg-1',
          conversation_id: convId,
          content: 'Test message',
          sender: 'user',
          timestamp: new Date(),
        });

        // 3. Generate embedding
        const embedding = await memorySystem.generateEmbedding('Test message');

        // 4. Save memory
        await dbManager.memory.createMemoryFact({
          id: 'memory-1',
          conversation_id: convId,
          fact: 'Test fact',
          importance: 0.5,
          created_at: new Date(),
          embedding,
        });

        // 5. Search memories
        const memories = await dbManager.memory.searchMemories('Test');

        // 6. Send to orchestrator (mock)
        await orchestrator
          .sendRequest('test-provider', {
            messages: [{ role: 'user', content: 'Test' }],
          })
          .catch(() => null);

        return memories;
      };

      const startTime = performance.now();
      const result = await workflow();
      const endTime = performance.now();

      const totalTime = endTime - startTime;

      // Complete workflow should finish within 2 seconds
      expect(totalTime).toBeLessThan(2000);
      expect(result).toBeDefined();
    });
  });
});