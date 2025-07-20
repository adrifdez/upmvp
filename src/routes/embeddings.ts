import { Hono } from 'hono'
import { EmbeddingService } from '../services/EmbeddingService.js'
import { supabase } from '../config/supabase.js'
import { z } from 'zod'

const embeddingsRoutes = new Hono()

// GET /api/embeddings/status - Check embeddings status
embeddingsRoutes.get('/status', async (c) => {
  try {
    // Check if OpenAI key is available
    const openaiKey = process.env.OPENAI_API_KEY
    const hasKey = openaiKey && openaiKey.startsWith('sk-')
    
    // Get guidelines statistics
    const { count: totalGuidelines } = await supabase
      .from('guidelines')
      .select('id', { count: 'exact', head: true })
    
    const { count: guidelinesWithEmbeddings, error: embeddingCountError } = await supabase
      .from('guidelines')
      .select('id', { count: 'exact', head: true })
      .not('condition_embedding', 'is', null)
    console.log(guidelinesWithEmbeddings, embeddingCountError)
    // Get message embeddings cache stats
    const { count: cachedEmbeddings } = await supabase
      .from('message_embeddings')
      .select('*', { count: 'exact', head: true })
    
    return c.json({
      status: 'ok',
      openai_configured: hasKey,
      guidelines: {
        total: totalGuidelines || 0,
        with_embeddings: guidelinesWithEmbeddings || 0,
        missing_embeddings: (totalGuidelines || 0) - (guidelinesWithEmbeddings || 0)
      },
      message_cache: {
        total: cachedEmbeddings || 0
      },
      embedding_model: hasKey ? 'text-embedding-3-small' : null,
      vector_search_enabled: hasKey && (guidelinesWithEmbeddings || 0) > 0
    })
  } catch (error) {
    return c.json({ 
      error: 'Failed to get embeddings status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// POST /api/embeddings/generate - Generate embeddings for all guidelines
embeddingsRoutes.post('/generate', async (c) => {
  try {
    const embeddingService = new EmbeddingService(supabase)
    
    // Check for optional guideline IDs in request body
    const body = await c.req.json().catch(() => ({}))
    const guidelineIds = body.guidelineIds
    
    // Start generation process
    await embeddingService.updateGuidelineEmbeddings(guidelineIds)
    
    // Get updated statistics
    const { data: stats } = await supabase
      .from('guidelines')
      .select('id', { count: 'exact' })
      .not('condition_embedding', 'is', null)
    
    return c.json({
      success: true,
      message: 'Embeddings generation completed',
      guidelines_with_embeddings: stats?.length || 0
    })
  } catch (error) {
    return c.json({ 
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// POST /api/embeddings/test - Test vector search
const testSearchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  threshold: z.number().min(0).max(1).default(0.6),
  limit: z.number().min(1).max(50).default(5)
})

embeddingsRoutes.post('/test', async (c) => {
  try {
    const body = await c.req.json()
    const { query, threshold, limit } = testSearchSchema.parse(body)
    
    const embeddingService = new EmbeddingService(supabase)
    
    // Generate embedding for query
    const queryEmbedding = await embeddingService.generateEmbedding(query)
    
    // Search for similar guidelines
    const results = await embeddingService.searchGuidelinesByVector(
      queryEmbedding.embedding,
      threshold,
      limit
    )
    
    return c.json({
      query,
      results: results.map(r => ({
        id: r.id,
        condition: r.condition,
        action: r.action,
        category: r.category,
        similarity: r.similarity,
        similarity_percentage: (r.similarity * 100).toFixed(1) + '%'
      }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    return c.json({ 
      error: 'Failed to test vector search',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// DELETE /api/embeddings/cleanup - Clean up old message embeddings
embeddingsRoutes.delete('/cleanup', async (c) => {
  try {
    const embeddingService = new EmbeddingService(supabase)
    
    // Get days from query param, default to 7
    const days = parseInt(c.req.query('days') || '7')
    
    const deletedCount = await embeddingService.cleanupOldEmbeddings(days)
    
    return c.json({
      success: true,
      message: `Cleaned up ${deletedCount} old embeddings`,
      deleted_count: deletedCount,
      older_than_days: days
    })
  } catch (error) {
    return c.json({ 
      error: 'Failed to cleanup embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /api/embeddings/guidelines/:id - Get specific guideline with embedding info
embeddingsRoutes.get('/guidelines/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const { data: guideline, error } = await supabase
      .from('guidelines')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !guideline) {
      return c.json({ error: 'Guideline not found' }, 404)
    }
    
    return c.json({
      ...guideline,
      has_embedding: guideline.condition_embedding !== null,
      embedding_dimension: guideline.condition_embedding ? 
        (Array.isArray(guideline.condition_embedding) ? guideline.condition_embedding.length : 'Invalid') : 
        null
    })
  } catch (error) {
    return c.json({ 
      error: 'Failed to get guideline',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export { embeddingsRoutes }