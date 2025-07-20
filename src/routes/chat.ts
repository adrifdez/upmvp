import { Hono } from 'hono'
import { ChatService } from '../services/ChatService'
import { GuidelineService } from '../services/GuidelineService'
import { MatchingService } from '../services/MatchingService'
import { VectorMatchingService } from '../services/VectorMatchingService.js'
import { EmbeddingService } from '../services/EmbeddingService.js'
import { ConversationService } from '../services/ConversationService'
import { supabase } from '../config/supabase'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { SupabaseClient } from '@supabase/supabase-js'

const chatRoutes = new Hono()

// Factory function for creating matching service
const createMatchingService = (method: 'text' | 'vector', supabaseClient: SupabaseClient): MatchingService => {
  if (method !== 'vector') {
    console.log('Using text-based MatchingService')
    return new MatchingService()
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const hasValidApiKey = openaiKey && 
                         openaiKey !== 'your-openai-api-key' && 
                         openaiKey.startsWith('sk-')

  if (hasValidApiKey) {
    console.log('Using VectorMatchingService with OpenAI embeddings')
    const embeddingService = new EmbeddingService(supabaseClient)
    return new VectorMatchingService(embeddingService)
  }

  console.log('Vector method requested but no OpenAI key available, falling back to text-based matching')
  return new MatchingService()
}

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),
  context: z.record(z.any()).optional(),
  matchingMethod: z.enum(['text', 'vector']).default('vector').optional(),
  hybridWeight: z.number().min(0).max(1).default(0.8).optional()
})

chatRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const validatedData = chatRequestSchema.parse(body)
    
    // Generate sessionId if not provided
    const sessionId = validatedData.sessionId || uuidv4()
    
    const guidelineService = new GuidelineService()
    
    // Create matching service based on method and API key availability
    const matchingService = createMatchingService(
      validatedData.matchingMethod || 'vector',
      supabase
    )
    
    const conversationService = new ConversationService()
    const chatService = new ChatService(guidelineService, matchingService, conversationService)
    
    const response = await chatService.processMessage(
      sessionId,
      validatedData.message,
      validatedData.hybridWeight
    )
    
    return c.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: error.errors }, 400)
    }
    throw error
  }
})

export { chatRoutes }