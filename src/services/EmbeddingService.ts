import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openai } from '../config/openai.js';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  hash: string;
}

export interface VectorSearchResult {
  id: number;
  condition: string;
  action: string;
  category: string;
  priority: number;
  similarity: number;
}

export class EmbeddingService {
  private embeddingModel = 'text-embedding-3-small';

  constructor(private supabase: SupabaseClient) {}

  /**
   * Generate embedding for a given text using OpenAI
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {      
      const response = await openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding data received from OpenAI');
      }
      const hash = this.hashText(text);

      return {
        embedding,
        model: this.embeddingModel,
        hash
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create embedding for a message
   */
  async getOrCreateMessageEmbedding(
    sessionId: string, 
    messageText: string
  ): Promise<EmbeddingResult> {
    const hash = this.hashText(messageText);

    // Check if embedding already exists
    const { data: existing } = await this.supabase
      .from('message_embeddings')
      .select('embedding, embedding_model')
      .eq('message_hash', hash)
      .single();

    if (existing && existing.embedding) {
      return {
        embedding: existing.embedding,
        model: existing.embedding_model,
        hash
      };
    }

    // Generate new embedding
    const embeddingResult = await this.generateEmbedding(messageText);

    // Store in database
    const { error: insertError } = await this.supabase
      .from('message_embeddings')
      .upsert({
        session_id: sessionId,
        message_hash: hash,
        message_text: messageText,
        embedding: embeddingResult.embedding,
        embedding_model: this.embeddingModel
      });

    if (insertError) {
      console.error('Error storing message embedding:', insertError);
    }

    return embeddingResult;
  }

  /**
   * Search guidelines by vector similarity
   */
  async searchGuidelinesByVector(
    queryEmbedding: number[],
    threshold: number = 0.7,
    limit: number = 20
  ): Promise<VectorSearchResult[]> {
    const { data, error } = await this.supabase
      .rpc('search_guidelines_by_vector', {
        query_embedding: queryEmbedding,
        similarity_threshold: threshold,
        max_results: limit
      });

    if (error) {
      console.error('Error searching guidelines by vector:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update guideline embeddings in batch
   */
  async updateGuidelineEmbeddings(guidelineIds?: number[]): Promise<void> {
    // Get guidelines that need embeddings
    const baseQuery = this.supabase
      .from('guidelines')
      .select('id, condition')
      .is('condition_embedding', null);

    const query = (guidelineIds && guidelineIds.length > 0)
      ? baseQuery.in('id', guidelineIds)
      : baseQuery;

    const { data: guidelines, error } = await query;

    if (error) {
      console.error('Error fetching guidelines:', error);
      throw new Error(`Failed to fetch guidelines: ${error.message}`);
    }

    if (!guidelines || guidelines.length === 0) {
      console.log('No guidelines need embedding updates');
      return;
    }

    // Process in batches to avoid rate limits
    const batchSize = 10;
    const batches = Array.from(
      { length: Math.ceil(guidelines.length / batchSize) },
      (_, i) => guidelines.slice(i * batchSize, (i + 1) * batchSize)
    );

    await batches.reduce(async (previousBatch, batch, index) => {
      await previousBatch;
      
      await Promise.all(
        batch.map(async (guideline) => {
          try {
            const embeddingResult = await this.generateEmbedding(guideline.condition);
            
            const { error: updateError } = await this.supabase
              .from('guidelines')
              .update({
                condition_embedding: embeddingResult.embedding,
                embedding_model: this.embeddingModel,
                embedding_generated_at: new Date().toISOString()
              })
              .eq('id', guideline.id);

            if (updateError) {
              console.error(`Error updating embedding for guideline ${guideline.id}:`, updateError);
            } else {
              console.log(`Updated embedding for guideline ${guideline.id}`);
            }
          } catch (error) {
            console.error(`Failed to generate embedding for guideline ${guideline.id}:`, error);
          }
        })
      );

      // Rate limiting delay
      if (index < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }, Promise.resolve());
  }

  /**
   * Calculate similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    const { dotProduct, norm1, norm2 } = embedding1.reduce(
      (acc, val1, i) => {
        const val2 = embedding2[i] ?? 0;
        return {
          dotProduct: acc.dotProduct + val1 * val2,
          norm1: acc.norm1 + val1 * val1,
          norm2: acc.norm2 + val2 * val2
        };
      },
      { dotProduct: 0, norm1: 0, norm2: 0 }
    );

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return similarity;
  }

  /**
   * Clean up old message embeddings
   */
  async cleanupOldEmbeddings(daysToKeep: number = 7): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('cleanup_old_embeddings', { days_to_keep: daysToKeep });

    if (error) {
      console.error('Error cleaning up embeddings:', error);
      return 0;
    }

    return data || 0;
  }

  /**
   * Generate hash for text to use as cache key
   */
  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
}