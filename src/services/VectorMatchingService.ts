import { MatchingService } from './MatchingService.js';
import { EmbeddingService } from './EmbeddingService.js';
import type { Guideline, MatchScore, StoredMessage } from '../types/index.js';

export interface VectorMatchScore extends MatchScore {
  vectorScore?: number;
  textScore?: number;
  hybridScore?: number;
}

export class VectorMatchingService extends MatchingService {
  constructor(private embeddingService: EmbeddingService) {
    super();
  }


  /**
   * Find matching guidelines using hybrid approach (vector + text)
   */
  async findMatchingGuidelinesWithVectors(
    userMessage: string,
    guidelines: Guideline[],
    sessionId: string,
    vectorWeight: number = 0.8
  ): Promise<VectorMatchScore[]> {
    try {
      // Usar un peso alto para embeddings ya que todo está en español
      const adjustedVectorWeight = vectorWeight;
      
      // Generate embedding for user message
      const messageEmbedding = await this.embeddingService.getOrCreateMessageEmbedding(
        sessionId,
        userMessage
      );

      // Search for similar guidelines using vector similarity
      const vectorResults = await this.embeddingService.searchGuidelinesByVector(
        messageEmbedding.embedding,
        0.3, // Lowered threshold for better semantic matching
        30   // Get more results for better ranking
      );

      // Create a map of vector scores
      const vectorScoreMap = new Map<number, number>(
        vectorResults.map(result => [result.id, result.similarity * 100])
      );

      // Calculate hybrid scores
      const hybridScores: VectorMatchScore[] = guidelines.map(guideline => {
        // Get text-based score
        const textScore = this.calculateScore(userMessage, guideline);
        
        // Get vector score (0 if not in vector results)
        const vectorScore = vectorScoreMap.get(guideline.id) || 0;
        
        // Calculate weighted hybrid score
        const hybridScore = (vectorScore * adjustedVectorWeight) + (textScore * (1 - adjustedVectorWeight));
        
        return {
          guideline,
          score: hybridScore,
          matched: hybridScore > 30,
          vectorScore,
          textScore,
          hybridScore
        };
      });

      // Sort by hybrid score
      return hybridScores.sort((a, b) => b.score - a.score);

    } catch (error) {
      console.error('Error in vector matching, falling back to text-only:', error);
      
      // Fallback to text-only matching
      return this.rankGuidelines(guidelines, userMessage).map(score => ({
        ...score,
        textScore: score.score,
        vectorScore: 0,
        hybridScore: score.score
      }));
    }
  }

  /**
   * Rank guidelines with context using vectors
   */
  async rankGuidelinesWithVectorContext(
    guidelines: Guideline[],
    userMessage: string,
    sessionId: string,
    previousMessages: StoredMessage[] = [],
    vectorWeight: number = 0.7
  ): Promise<VectorMatchScore[]> {
    // Get base hybrid scores (will automatically adjust weight for Spanish)
    const hybridScores = await this.findMatchingGuidelinesWithVectors(
      userMessage,
      guidelines,
      sessionId,
      vectorWeight
    );

    // Add context bonus
    const scoresWithContext = hybridScores.map(score => {
      const contextBonus = this.calculateContextBonus(score.guideline, previousMessages);
      
      return {
        ...score,
        score: Math.min(score.score + contextBonus, 100),
        hybridScore: Math.min((score.hybridScore || 0) + contextBonus, 100)
      };
    });

    // Re-sort after adding context
    return scoresWithContext.sort((a, b) => b.score - a.score);
  }

  /**
   * Find semantically similar guidelines
   */
  async findSemanticallySimilarGuidelines(
    referenceGuideline: Guideline,
    allGuidelines: Guideline[],
    threshold: number = 0.8
  ): Promise<Array<{guideline: Guideline, similarity: number}>> {
    // This could be used to find duplicate or conflicting guidelines
    try {
      const referenceEmbedding = await this.embeddingService.generateEmbedding(
        referenceGuideline.condition
      );

      const similarities = await Promise.all(
        allGuidelines
          .filter(g => g.id !== referenceGuideline.id)
          .map(async (guideline) => {
            // For now, we'll calculate similarity based on condition text
            // In the future, this could use pre-computed embeddings
            try {
              const guidelineEmbedding = await this.embeddingService.generateEmbedding(
                guideline.condition
              );
              
              const similarity = this.embeddingService.cosineSimilarity(
                referenceEmbedding.embedding,
                guidelineEmbedding.embedding
              );

              return { guideline, similarity };
            } catch {
              return { guideline, similarity: 0 };
            }
          })
      );

      return similarities
        .filter(s => s.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

    } catch (error) {
      console.error('Error finding similar guidelines:', error);
      return [];
    }
  }

  /**
   * Analyze conversation context using embeddings
   */
  async analyzeConversationContext(
    messages: StoredMessage[],
    sessionId: string
  ): Promise<{
    topics: string[];
    avgEmbedding?: number[];
    contextShift: number;
  }> {
    if (messages.length === 0) {
      return { topics: [], contextShift: 0 };
    }

    try {
      // Get embeddings for all messages
      const embeddings = await Promise.all(
        messages.map(msg => 
          this.embeddingService.getOrCreateMessageEmbedding(sessionId, msg.content)
        )
      );

      // Calculate average embedding for context
      const avgEmbedding = this.calculateAverageEmbedding(
        embeddings.map(e => e.embedding)
      );

      // Detect topics based on embeddings clustering
      const topics = this.detectTopicsFromMessages(messages);

      // Calculate context shift (how much the conversation has changed)
      const contextShift = embeddings.length > 1
        ? embeddings
            .slice(1)
            .reduce((totalShift, embedding, index) => {
              const prevEmbedding = embeddings[index];
              if (!prevEmbedding) return totalShift;
              
              const similarity = this.embeddingService.cosineSimilarity(
                prevEmbedding.embedding,
                embedding.embedding
              );
              return totalShift + (1 - similarity);
            }, 0) / (embeddings.length - 1)
        : 0;

      return {
        topics,
        avgEmbedding,
        contextShift
      };

    } catch (error) {
      console.error('Error analyzing conversation context:', error);
      return { topics: [], contextShift: 0 };
    }
  }

  /**
   * Calculate average of multiple embeddings
   */
  private calculateAverageEmbedding(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const firstEmbedding = embeddings[0];
    if (!firstEmbedding) return [];
    
    const dimension = firstEmbedding.length;
    
    return Array.from({ length: dimension }, (_, i) =>
      embeddings.reduce((sum, embedding) => {
        const value = embedding[i];
        return sum + (value ?? 0);
      }, 0) / embeddings.length
    );
  }

  /**
   * Detect topics from messages
   */
  private detectTopicsFromMessages(messages: StoredMessage[]): string[] {
    const topics = messages
      .map(msg => this.detectMessageCategory(msg.content))
      .filter((category): category is string => category !== null && category !== undefined);

    return [...new Set(topics)];
  }
}