import type { 
  MemoryExtractionRequest, 
  MemoryExtractionResult, 
  MemoryFact, 
  EntityRelationship, 
  ConversationSummary 
} from '../types/memory';
import type { ChatMessage } from '../types/chat';

/**
 * Memory fact extraction and processing system
 * Requirements: 8.1, 8.4
 */
export class MemoryExtractor {
  
  /**
   * Extract memory facts from conversation messages
   * Requirements: 8.1, 8.4
   */
  async extractMemory(request: MemoryExtractionRequest): Promise<MemoryExtractionResult> {
    const startTime = Date.now();
    const result: MemoryExtractionResult = {
      facts: [],
      relationships: [],
      confidence: 0,
      processingTime: 0
    };

    try {
      // Extract facts if requested
      if (request.extractionType === 'facts' || request.extractionType === 'all') {
        result.facts = await this.extractFacts(request.messages, request.context);
      }

      // Extract relationships if requested
      if (request.extractionType === 'relationships' || request.extractionType === 'all') {
        result.relationships = await this.extractRelationships(request.messages, request.context);
      }

      // Generate summary if requested
      if (request.extractionType === 'summary' || request.extractionType === 'all') {
        result.summary = await this.generateSummary(request.messages, request.context);
      }

      // Calculate overall confidence based on extraction quality
      result.confidence = this.calculateExtractionConfidence(result);
      result.processingTime = Date.now() - startTime;

      return result;
    } catch (error) {
      console.error('Memory extraction failed:', error);
      result.confidence = 0;
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Extract factual information from messages
   * Requirements: 8.1, 8.4
   */
  private async extractFacts(
    messages: Array<{ id: string; content: string; sender: string; timestamp: Date }>,
    context?: any
  ): Promise<Omit<MemoryFact, 'id' | 'embedding'>[]> {
    const facts: Omit<MemoryFact, 'id' | 'embedding'>[] = [];

    for (const message of messages) {
      // Skip very short messages
      if (message.content.length < 10) {
        continue;
      }

      // Extract facts using pattern matching and heuristics
      const extractedFacts = this.extractFactsFromText(message.content, message);
      facts.push(...extractedFacts);
    }

    // Deduplicate and score facts
    return this.deduplicateAndScoreFacts(facts);
  }

  /**
   * Extract facts from individual text using pattern matching
   * Requirements: 8.1, 8.4
   */
  private extractFactsFromText(
    text: string, 
    message: { id: string; sender: string; timestamp: Date }
  ): Omit<MemoryFact, 'id' | 'embedding'>[] {
    const facts: Omit<MemoryFact, 'id' | 'embedding'>[] = [];

    // Pattern 1: Statements with "is", "are", "was", "were"
    const isPatterns = text.match(/([A-Z][^.!?]*(?:is|are|was|were)[^.!?]*[.!?])/gi);
    if (isPatterns) {
      isPatterns.forEach(match => {
        facts.push({
          content: match.trim(),
          source: message.sender,
          timestamp: message.timestamp,
          relevanceScore: 0.7,
          tags: ['statement', 'definition'],
          verified: false,
          references: [message.id]
        });
      });
    }

    // Pattern 2: Definitions and explanations
    const definitionPatterns = text.match(/([A-Z][^.!?]*(?:means|refers to|is defined as|represents)[^.!?]*[.!?])/gi);
    if (definitionPatterns) {
      definitionPatterns.forEach(match => {
        facts.push({
          content: match.trim(),
          source: message.sender,
          timestamp: message.timestamp,
          relevanceScore: 0.8,
          tags: ['definition', 'explanation'],
          verified: false,
          references: [message.id]
        });
      });
    }

    // Pattern 3: Numerical facts and statistics
    const numericalPatterns = text.match(/([A-Z][^.!?]*\d+[^.!?]*[.!?])/gi);
    if (numericalPatterns) {
      numericalPatterns.forEach(match => {
        facts.push({
          content: match.trim(),
          source: message.sender,
          timestamp: message.timestamp,
          relevanceScore: 0.6,
          tags: ['numerical', 'statistic'],
          verified: false,
          references: [message.id]
        });
      });
    }

    // Pattern 4: Cause and effect relationships
    const causalPatterns = text.match(/([A-Z][^.!?]*(?:because|due to|results in|causes|leads to)[^.!?]*[.!?])/gi);
    if (causalPatterns) {
      causalPatterns.forEach(match => {
        facts.push({
          content: match.trim(),
          source: message.sender,
          timestamp: message.timestamp,
          relevanceScore: 0.75,
          tags: ['causal', 'relationship'],
          verified: false,
          references: [message.id]
        });
      });
    }

    // Pattern 5: Procedural knowledge (how-to)
    const proceduralPatterns = text.match(/([A-Z][^.!?]*(?:to|you can|should|must|need to)[^.!?]*[.!?])/gi);
    if (proceduralPatterns) {
      proceduralPatterns.forEach(match => {
        if (match.length > 20) { // Only capture substantial procedural knowledge
          facts.push({
            content: match.trim(),
            source: message.sender,
            timestamp: message.timestamp,
            relevanceScore: 0.65,
            tags: ['procedural', 'instruction'],
            verified: false,
            references: [message.id]
          });
        }
      });
    }

    return facts;
  }

  /**
   * Extract entity relationships from messages
   * Requirements: 8.1, 8.4
   */
  private async extractRelationships(
    messages: Array<{ id: string; content: string; sender: string; timestamp: Date }>,
    context?: any
  ): Promise<Omit<EntityRelationship, 'id'>[]> {
    const relationships: Omit<EntityRelationship, 'id'>[] = [];

    for (const message of messages) {
      const extractedRelationships = this.extractRelationshipsFromText(message.content, message);
      relationships.push(...extractedRelationships);
    }

    return this.deduplicateRelationships(relationships);
  }

  /**
   * Extract relationships from individual text
   * Requirements: 8.1, 8.4
   */
  private extractRelationshipsFromText(
    text: string,
    message: { id: string; sender: string; timestamp: Date }
  ): Omit<EntityRelationship, 'id'>[] {
    const relationships: Omit<EntityRelationship, 'id'>[] = [];

    // Pattern 1: "X is a Y" relationships
    const isAPatterns = text.match(/([A-Z][a-z]+)\s+is\s+a\s+([a-z]+)/gi);
    if (isAPatterns) {
      isAPatterns.forEach(match => {
        const parts = match.match(/([A-Z][a-z]+)\s+is\s+a\s+([a-z]+)/i);
        if (parts) {
          relationships.push({
            sourceEntity: parts[1],
            targetEntity: parts[2],
            relationshipType: 'is_a',
            confidence: 0.8,
            evidence: [message.id],
            createdBy: message.sender,
            createdAt: message.timestamp
          });
        }
      });
    }

    // Pattern 2: "X has Y" relationships
    const hasPatterns = text.match(/([A-Z][a-z]+)\s+has\s+([a-z]+)/gi);
    if (hasPatterns) {
      hasPatterns.forEach(match => {
        const parts = match.match(/([A-Z][a-z]+)\s+has\s+([a-z]+)/i);
        if (parts) {
          relationships.push({
            sourceEntity: parts[1],
            targetEntity: parts[2],
            relationshipType: 'has',
            confidence: 0.7,
            evidence: [message.id],
            createdBy: message.sender,
            createdAt: message.timestamp
          });
        }
      });
    }

    // Pattern 3: "X belongs to Y" relationships
    const belongsToPatterns = text.match(/([A-Z][a-z]+)\s+belongs\s+to\s+([A-Z][a-z]+)/gi);
    if (belongsToPatterns) {
      belongsToPatterns.forEach(match => {
        const parts = match.match(/([A-Z][a-z]+)\s+belongs\s+to\s+([A-Z][a-z]+)/i);
        if (parts) {
          relationships.push({
            sourceEntity: parts[1],
            targetEntity: parts[2],
            relationshipType: 'belongs_to',
            confidence: 0.75,
            evidence: [message.id],
            createdBy: message.sender,
            createdAt: message.timestamp
          });
        }
      });
    }

    return relationships;
  }

  /**
   * Generate conversation summary
   * Requirements: 8.3, 8.5
   */
  private async generateSummary(
    messages: Array<{ id: string; content: string; sender: string; timestamp: Date }>,
    context?: any
  ): Promise<Omit<ConversationSummary, 'id' | 'embedding'> | undefined> {
    if (messages.length < 3) {
      return undefined; // Not enough messages to summarize
    }

    const participants = [...new Set(messages.map(m => m.sender))];
    const timeRange = {
      start: new Date(Math.min(...messages.map(m => m.timestamp.getTime()))),
      end: new Date(Math.max(...messages.map(m => m.timestamp.getTime())))
    };

    // Extract key topics and themes
    const keyPoints = this.extractKeyPoints(messages);
    
    // Generate summary text
    const summary = this.generateSummaryText(messages, keyPoints);

    return {
      timeRange,
      summary,
      keyPoints,
      participants,
      messageCount: messages.length,
      createdBy: 'system',
      createdAt: new Date()
    };
  }

  /**
   * Extract key points from messages
   * Requirements: 8.3, 8.5
   */
  private extractKeyPoints(messages: Array<{ content: string; sender: string }>): string[] {
    const keyPoints: string[] = [];
    const topicFrequency: Map<string, number> = new Map();

    // Extract potential topics (nouns and noun phrases)
    messages.forEach(message => {
      const words = message.content.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      words.forEach(word => {
        if (!this.isStopWord(word)) {
          topicFrequency.set(word, (topicFrequency.get(word) || 0) + 1);
        }
      });
    });

    // Get most frequent topics
    const sortedTopics = Array.from(topicFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // Create key points based on frequent topics
    sortedTopics.forEach(topic => {
      const relevantMessages = messages.filter(m => 
        m.content.toLowerCase().includes(topic)
      );
      
      if (relevantMessages.length > 1) {
        keyPoints.push(`Discussion about ${topic} (${relevantMessages.length} messages)`);
      }
    });

    return keyPoints;
  }

  /**
   * Generate summary text from messages and key points
   * Requirements: 8.3, 8.5
   */
  private generateSummaryText(
    messages: Array<{ content: string; sender: string }>,
    keyPoints: string[]
  ): string {
    const participants = [...new Set(messages.map(m => m.sender))];
    const participantText = participants.length > 1 
      ? `Conversation between ${participants.join(', ')}`
      : `Messages from ${participants[0]}`;

    const topicsText = keyPoints.length > 0
      ? ` covering topics including ${keyPoints.slice(0, 3).join(', ')}`
      : '';

    return `${participantText} with ${messages.length} messages${topicsText}.`;
  }

  /**
   * Deduplicate and score facts based on similarity
   * Requirements: 8.1, 8.5
   */
  private deduplicateAndScoreFacts(
    facts: Omit<MemoryFact, 'id' | 'embedding'>[]
  ): Omit<MemoryFact, 'id' | 'embedding'>[] {
    const uniqueFacts: Omit<MemoryFact, 'id' | 'embedding'>[] = [];
    
    for (const fact of facts) {
      // Check for similar existing facts
      const similar = uniqueFacts.find(existing => 
        this.calculateTextSimilarity(fact.content, existing.content) > 0.8
      );

      if (similar) {
        // Merge with existing fact
        similar.references.push(...fact.references);
        similar.relevanceScore = Math.max(similar.relevanceScore, fact.relevanceScore);
        similar.verified = similar.verified || fact.verified;
        similar.tags = [...new Set([...similar.tags, ...fact.tags])];
      } else {
        uniqueFacts.push(fact);
      }
    }

    return uniqueFacts;
  }

  /**
   * Deduplicate relationships
   * Requirements: 8.1, 8.4
   */
  private deduplicateRelationships(
    relationships: Omit<EntityRelationship, 'id'>[]
  ): Omit<EntityRelationship, 'id'>[] {
    const uniqueRelationships: Omit<EntityRelationship, 'id'>[] = [];
    
    for (const relationship of relationships) {
      const similar = uniqueRelationships.find(existing =>
        existing.sourceEntity.toLowerCase() === relationship.sourceEntity.toLowerCase() &&
        existing.targetEntity.toLowerCase() === relationship.targetEntity.toLowerCase() &&
        existing.relationshipType === relationship.relationshipType
      );

      if (similar) {
        // Merge evidence
        similar.evidence.push(...relationship.evidence);
        similar.confidence = Math.max(similar.confidence, relationship.confidence);
      } else {
        uniqueRelationships.push(relationship);
      }
    }

    return uniqueRelationships;
  }

  /**
   * Calculate extraction confidence based on results
   * Requirements: 8.1, 8.4
   */
  private calculateExtractionConfidence(result: MemoryExtractionResult): number {
    let confidence = 0;
    let factors = 0;

    if (result.facts.length > 0) {
      const avgFactConfidence = result.facts.reduce((sum, fact) => sum + fact.relevanceScore, 0) / result.facts.length;
      confidence += avgFactConfidence;
      factors++;
    }

    if (result.relationships.length > 0) {
      const avgRelationshipConfidence = result.relationships.reduce((sum, rel) => sum + rel.confidence, 0) / result.relationships.length;
      confidence += avgRelationshipConfidence;
      factors++;
    }

    if (result.summary) {
      confidence += 0.7; // Base confidence for summary generation
      factors++;
    }

    return factors > 0 ? confidence / factors : 0;
  }

  /**
   * Calculate simple text similarity using Jaccard similarity
   * Requirements: 8.1, 8.5
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Check if a word is a stop word
   * Requirements: 8.3, 8.5
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);
    
    return stopWords.has(word.toLowerCase());
  }
}