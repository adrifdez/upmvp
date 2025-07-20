import { Hono } from 'hono'
import { supabase } from '../config/supabase'

const conversationRoutes = new Hono()

// GET /api/conversations/:sessionId - obtener historial
conversationRoutes.get('/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    
    if (!sessionId) {
      return c.json({ error: 'Session ID is required' }, 400)
    }
    
    // Get conversation by sessionId
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    
    if (error || !conversation) {
      return c.json({ 
        error: 'Conversation not found',
        sessionId 
      }, 404)
    }
    
    return c.json({
      sessionId,
      conversationId: conversation.id,
      messages: conversation.messages || [],
      usedGuidelineIds: conversation.used_guideline_ids || [],
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at
    })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return c.json({ 
      error: 'Failed to fetch conversation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// DELETE /api/conversations/:sessionId - limpiar sesión
conversationRoutes.delete('/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    
    if (!sessionId) {
      return c.json({ error: 'Session ID is required' }, 400)
    }
    
    // Delete conversation and related guideline usage
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('session_id', sessionId)
      .single()
    
    if (fetchError || !conversation) {
      return c.json({ 
        error: 'Conversation not found',
        sessionId 
      }, 404)
    }
    
    // Delete guideline usage records first (foreign key constraint)
    const { error: usageDeleteError } = await supabase
      .from('guideline_usage')
      .delete()
      .eq('conversation_id', conversation.id)
    
    if (usageDeleteError) {
      console.error('Error deleting guideline usage:', usageDeleteError)
    }
    
    // Delete the conversation
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('session_id', sessionId)
    
    if (deleteError) {
      throw deleteError
    }
    
    return c.json({
      message: 'Conversation deleted successfully',
      sessionId
    })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return c.json({ 
      error: 'Failed to delete conversation',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export { conversationRoutes }