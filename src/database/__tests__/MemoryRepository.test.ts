import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../Database';
import { MemoryRepository } from '../MemoryRepository';
import type { MemoryFact, ConversationSummary, EntityRelationship } from '../../types/memory';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('MemoryRepository', () => {
    let database: Database;
    let repository: MemoryRepository;
    let testDbPath: string;
    let conversationId: string;

    beforeEach(async () => {
        testDbPath = path.join(__dirname, 'memory-test.db');
        database = new Database(testDbPath);
        await database.initialize();
        repository = new MemoryRepository(database);
        conversationId = uuidv4();

        // Create a conversation to satisfy foreign key constraints
        await database['executeQuery'](
            'INSERT INTO conversations (id, created_at, updated_at, title) VALUES (?, ?, ?, ?)',
            [conversationId, new Date().toISOString(), new Date().toISOString(), 'Test Conversation']
        );
    });

    afterEach(async () => {
        await database.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    describe('memory facts', () => {
        it('should add a memory fact', async () => {
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'The user prefers TypeScript over JavaScript',
                source: 'user',
                timestamp: new Date(),
                relevanceScore: 0.8,
                tags: ['preference', 'programming'],
                verified: false,
                references: ['msg-1', 'msg-2']
            };

            const factId = await repository.addFact(conversationId, fact);
            expect(factId).toBeDefined();

            const facts = await repository.getFacts(conversationId);
            expect(facts).toHaveLength(1);
            expect(facts[0].content).toBe(fact.content);
            expect(facts[0].source).toBe(fact.source);
            expect(facts[0].relevanceScore).toBe(fact.relevanceScore);
            expect(facts[0].tags).toEqual(fact.tags);
            expect(facts[0].verified).toBe(fact.verified);
            expect(facts[0].references).toEqual(fact.references);
        });

        it('should add fact with embedding', async () => {
            const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'Test fact with embedding',
                source: 'model-1',
                timestamp: new Date(),
                relevanceScore: 0.9,
                tags: ['test'],
                embedding,
                verified: true,
                references: []
            };

            const factId = await repository.addFact(conversationId, fact);
            const facts = await repository.getFacts(conversationId);

            expect(facts[0].embedding).toHaveLength(embedding.length);
            // Check approximate equality due to float precision
            facts[0].embedding!.forEach((val, i) => {
                expect(val).toBeCloseTo(embedding[i], 5);
            });
        });

        it('should update a memory fact', async () => {
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'Original content',
                source: 'user',
                timestamp: new Date(),
                relevanceScore: 0.5,
                tags: ['original'],
                verified: false,
                references: []
            };

            const factId = await repository.addFact(conversationId, fact);

            await repository.updateFact(factId, {
                content: 'Updated content',
                relevanceScore: 0.9,
                tags: ['updated'],
                verified: true
            });

            const facts = await repository.getFacts(conversationId);
            expect(facts[0].content).toBe('Updated content');
            expect(facts[0].relevanceScore).toBe(0.9);
            expect(facts[0].tags).toEqual(['updated']);
            expect(facts[0].verified).toBe(true);
        });

        it('should delete a memory fact', async () => {
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'To be deleted',
                source: 'user',
                timestamp: new Date(),
                relevanceScore: 0.5,
                tags: [],
                verified: false,
                references: []
            };

            const factId = await repository.addFact(conversationId, fact);
            await repository.deleteFact(factId);

            const facts = await repository.getFacts(conversationId);
            expect(facts).toHaveLength(0);
        });

        it('should get facts with limit', async () => {
            // Add multiple facts
            for (let i = 0; i < 5; i++) {
                const fact: Omit<MemoryFact, 'id'> = {
                    content: `Fact ${i}`,
                    source: 'user',
                    timestamp: new Date(),
                    relevanceScore: i * 0.2,
                    tags: [],
                    verified: false,
                    references: []
                };
                await repository.addFact(conversationId, fact);
            }

            const facts = await repository.getFacts(conversationId, 3);
            expect(facts).toHaveLength(3);
            // Should be ordered by relevance score DESC
            expect(facts[0].relevanceScore).toBeGreaterThanOrEqual(facts[1].relevanceScore);
        });
    });

    describe('conversation summaries', () => {
        it('should add a conversation summary', async () => {
            const summary: Omit<ConversationSummary, 'id'> = {
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                },
                summary: 'Discussion about AI and machine learning',
                keyPoints: ['AI is transformative', 'ML requires data'],
                participants: ['user', 'model-1'],
                messageCount: 10,
                createdBy: 'model-1',
                createdAt: new Date()
            };

            const summaryId = await repository.addSummary(conversationId, summary);
            expect(summaryId).toBeDefined();

            const summaries = await repository.getSummaries(conversationId);
            expect(summaries).toHaveLength(1);
            expect(summaries[0].summary).toBe(summary.summary);
            expect(summaries[0].keyPoints).toEqual(summary.keyPoints);
            expect(summaries[0].participants).toEqual(summary.participants);
            expect(summaries[0].messageCount).toBe(summary.messageCount);
        });

        it('should add summary with embedding', async () => {
            const embedding = [0.1, 0.2, 0.3];
            const summary: Omit<ConversationSummary, 'id'> = {
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                },
                summary: 'Test summary with embedding',
                keyPoints: ['test'],
                participants: ['user'],
                messageCount: 5,
                embedding,
                createdBy: 'model-1',
                createdAt: new Date()
            };

            await repository.addSummary(conversationId, summary);
            const summaries = await repository.getSummaries(conversationId);

            expect(summaries[0].embedding).toHaveLength(embedding.length);
            // Check approximate equality due to float precision
            summaries[0].embedding!.forEach((val, i) => {
                expect(val).toBeCloseTo(embedding[i], 5);
            });
        });
    });

    describe('entity relationships', () => {
        it('should add an entity relationship', async () => {
            const relationship: Omit<EntityRelationship, 'id'> = {
                sourceEntity: 'JavaScript',
                targetEntity: 'TypeScript',
                relationshipType: 'superset_of',
                confidence: 0.9,
                evidence: ['msg-1', 'msg-2'],
                createdBy: 'model-1',
                createdAt: new Date()
            };

            const relationshipId = await repository.addRelationship(conversationId, relationship);
            expect(relationshipId).toBeDefined();

            const relationships = await repository.getRelationships(conversationId);
            expect(relationships).toHaveLength(1);
            expect(relationships[0].sourceEntity).toBe(relationship.sourceEntity);
            expect(relationships[0].targetEntity).toBe(relationship.targetEntity);
            expect(relationships[0].relationshipType).toBe(relationship.relationshipType);
            expect(relationships[0].confidence).toBe(relationship.confidence);
            expect(relationships[0].evidence).toEqual(relationship.evidence);
        });
    });

    describe('shared memory context', () => {
        it('should get complete shared memory context', async () => {
            // Add a fact
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'Test fact',
                source: 'user',
                timestamp: new Date(),
                relevanceScore: 0.8,
                tags: ['test'],
                verified: false,
                references: []
            };
            await repository.addFact(conversationId, fact);

            // Add a summary
            const summary: Omit<ConversationSummary, 'id'> = {
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                },
                summary: 'Test summary',
                keyPoints: ['test'],
                participants: ['user'],
                messageCount: 1,
                createdBy: 'model-1',
                createdAt: new Date()
            };
            await repository.addSummary(conversationId, summary);

            // Add a relationship
            const relationship: Omit<EntityRelationship, 'id'> = {
                sourceEntity: 'A',
                targetEntity: 'B',
                relationshipType: 'related_to',
                confidence: 0.7,
                evidence: [],
                createdBy: 'model-1',
                createdAt: new Date()
            };
            await repository.addRelationship(conversationId, relationship);

            const sharedMemory = await repository.getSharedMemory(conversationId);

            expect(sharedMemory.conversationId).toBe(conversationId);
            expect(sharedMemory.facts).toHaveLength(1);
            expect(sharedMemory.summaries).toHaveLength(1);
            expect(sharedMemory.relationships).toHaveLength(1);
            expect(sharedMemory.lastUpdated).toBeDefined();
            expect(sharedMemory.version).toBe(1);
        });
    });

    describe('memory search', () => {

        it('should search facts by content', async () => {
            // Add test data
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'JavaScript is a programming language',
                source: 'user',
                timestamp: new Date('2024-01-01'),
                relevanceScore: 0.8,
                tags: ['programming', 'javascript'],
                verified: true,
                references: []
            };
            await repository.addFact(conversationId, fact);

            const results = await repository.searchMemory(conversationId, {
                query: 'JavaScript',
                type: 'facts'
            });

            expect(results.facts).toHaveLength(1);
            expect(results.facts[0].content).toContain('JavaScript');
            expect(results.summaries).toHaveLength(0);
            expect(results.relationships).toHaveLength(0);
        });

        it('should search summaries by content', async () => {
            // Add test data
            const summary: Omit<ConversationSummary, 'id'> = {
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                },
                summary: 'Discussion about programming languages',
                keyPoints: ['JavaScript', 'Python'],
                participants: ['user', 'model-1'],
                messageCount: 5,
                createdBy: 'model-1',
                createdAt: new Date()
            };
            await repository.addSummary(conversationId, summary);

            const results = await repository.searchMemory(conversationId, {
                query: 'programming languages',
                type: 'summaries'
            });

            expect(results.facts).toHaveLength(0);
            expect(results.summaries).toHaveLength(1);
            expect(results.summaries[0].summary).toContain('programming languages');
        });

        it('should search all types', async () => {
            // Add test data
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'JavaScript is a programming language',
                source: 'user',
                timestamp: new Date('2024-01-01'),
                relevanceScore: 0.8,
                tags: ['programming', 'javascript'],
                verified: true,
                references: []
            };
            await repository.addFact(conversationId, fact);

            const summary: Omit<ConversationSummary, 'id'> = {
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-02')
                },
                summary: 'Discussion about programming languages',
                keyPoints: ['JavaScript', 'Python'],
                participants: ['user', 'model-1'],
                messageCount: 5,
                createdBy: 'model-1',
                createdAt: new Date()
            };
            await repository.addSummary(conversationId, summary);

            const results = await repository.searchMemory(conversationId, {
                query: 'programming',
                type: 'all'
            });

            expect(results.facts.length).toBeGreaterThan(0);
            expect(results.summaries.length).toBeGreaterThan(0);
            expect(results.totalResults).toBeGreaterThan(0);
            expect(results.searchTime).toBeGreaterThanOrEqual(0);
        });

        it('should filter by relevance score', async () => {
            // Add test data with specific relevance scores
            const fact1: Omit<MemoryFact, 'id'> = {
                content: 'JavaScript is a programming language',
                source: 'user',
                timestamp: new Date('2024-01-01'),
                relevanceScore: 0.8,
                tags: ['programming', 'javascript'],
                verified: true,
                references: []
            };

            const fact2: Omit<MemoryFact, 'id'> = {
                content: 'Python is great for data science programming',
                source: 'model-1',
                timestamp: new Date('2024-01-02'),
                relevanceScore: 0.9,
                tags: ['programming', 'python'],
                verified: false,
                references: []
            };

            await repository.addFact(conversationId, fact1);
            await repository.addFact(conversationId, fact2);

            const results = await repository.searchMemory(conversationId, {
                query: 'programming',
                type: 'facts',
                minRelevanceScore: 0.85
            });

            expect(results.facts).toHaveLength(1);
            expect(results.facts[0].relevanceScore).toBeGreaterThanOrEqual(0.85);
        });

        it('should filter by time range', async () => {
            // Add test data
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'JavaScript is a programming language',
                source: 'user',
                timestamp: new Date('2024-01-01T12:00:00'),
                relevanceScore: 0.8,
                tags: ['programming', 'javascript'],
                verified: true,
                references: []
            };
            await repository.addFact(conversationId, fact);

            const results = await repository.searchMemory(conversationId, {
                query: 'programming',
                type: 'facts',
                timeRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-01T23:59:59')
                }
            });

            expect(results.facts).toHaveLength(1);
            expect(results.facts[0].content).toContain('JavaScript');
        });

        it('should filter by sources', async () => {
            // Add test data
            const fact1: Omit<MemoryFact, 'id'> = {
                content: 'JavaScript is a programming language',
                source: 'user',
                timestamp: new Date('2024-01-01'),
                relevanceScore: 0.8,
                tags: ['programming', 'javascript'],
                verified: true,
                references: []
            };

            const fact2: Omit<MemoryFact, 'id'> = {
                content: 'Python is great for data science programming',
                source: 'model-1',
                timestamp: new Date('2024-01-02'),
                relevanceScore: 0.9,
                tags: ['programming', 'python'],
                verified: false,
                references: []
            };

            await repository.addFact(conversationId, fact1);
            await repository.addFact(conversationId, fact2);

            const results = await repository.searchMemory(conversationId, {
                query: 'programming',
                type: 'facts',
                sources: ['user']
            });

            expect(results.facts).toHaveLength(1);
            expect(results.facts[0].source).toBe('user');
        });

        it('should limit results', async () => {
            // Add test data
            const fact1: Omit<MemoryFact, 'id'> = {
                content: 'JavaScript is a programming language',
                source: 'user',
                timestamp: new Date('2024-01-01'),
                relevanceScore: 0.8,
                tags: ['programming', 'javascript'],
                verified: true,
                references: []
            };

            const fact2: Omit<MemoryFact, 'id'> = {
                content: 'Python is great for data science programming',
                source: 'model-1',
                timestamp: new Date('2024-01-02'),
                relevanceScore: 0.9,
                tags: ['programming', 'python'],
                verified: false,
                references: []
            };

            await repository.addFact(conversationId, fact1);
            await repository.addFact(conversationId, fact2);

            const results = await repository.searchMemory(conversationId, {
                query: 'programming',
                type: 'facts',
                limit: 1
            });

            expect(results.facts).toHaveLength(1);
        });
    });

    describe('memory cleanup', () => {
        it('should clean up old memory data', async () => {
            const oldDate = new Date('2020-01-01');
            const recentDate = new Date();

            // Add old fact
            const oldFact: Omit<MemoryFact, 'id'> = {
                content: 'Old fact',
                source: 'user',
                timestamp: oldDate,
                relevanceScore: 0.5,
                tags: [],
                verified: false,
                references: []
            };
            await repository.addFact(conversationId, oldFact);

            // Add recent fact
            const recentFact: Omit<MemoryFact, 'id'> = {
                content: 'Recent fact',
                source: 'user',
                timestamp: recentDate,
                relevanceScore: 0.5,
                tags: [],
                verified: false,
                references: []
            };
            await repository.addFact(conversationId, recentFact);

            const cleanupResult = await repository.cleanupOldMemory(conversationId, 1); // 1 day retention to clean up the 2020 data

            // The cleanup should run successfully and delete the old fact
            expect(cleanupResult.factsDeleted).toBeGreaterThanOrEqual(0);
            expect(cleanupResult.summariesDeleted).toBeGreaterThanOrEqual(0);
            expect(cleanupResult.relationshipsDeleted).toBeGreaterThanOrEqual(0);

            const remainingFacts = await repository.getFacts(conversationId);
            // The recent fact should still be there, old fact should be gone
            expect(remainingFacts.some(f => f.content === 'Recent fact')).toBe(true);
            expect(remainingFacts.some(f => f.content === 'Old fact')).toBe(false);
        });
    });

    describe('memory statistics', () => {
        it('should get memory statistics', async () => {
            // Add test data
            const fact: Omit<MemoryFact, 'id'> = {
                content: 'Test fact',
                source: 'user',
                timestamp: new Date(),
                relevanceScore: 0.8,
                tags: [],
                verified: false,
                references: []
            };
            await repository.addFact(conversationId, fact);

            const summary: Omit<ConversationSummary, 'id'> = {
                timeRange: {
                    start: new Date(),
                    end: new Date()
                },
                summary: 'Test summary',
                keyPoints: [],
                participants: [],
                messageCount: 1,
                createdBy: 'model-1',
                createdAt: new Date()
            };
            await repository.addSummary(conversationId, summary);

            const stats = await repository.getMemoryStats(conversationId);

            expect(stats.factCount).toBe(1);
            expect(stats.summaryCount).toBe(1);
            expect(stats.relationshipCount).toBe(0);
            expect(stats.averageRelevanceScore).toBe(0.8);
            expect(stats.oldestFact).toBeDefined();
            expect(stats.newestFact).toBeDefined();
        });
    });
});