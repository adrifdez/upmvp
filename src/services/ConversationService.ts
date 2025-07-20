import { supabase } from '../config/supabase.js';
import type { Conversation, StoredMessage } from '../types/index.js';

export class ConversationService {
  private maxHistorySize = 20;

  async createOrGetConversation(sessionId: string): Promise<Conversation> {
    try {
      // Try to get existing conversation
      const { data: existing, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (existing && !fetchError) {
        return existing;
      }

      // Create new conversation if doesn't exist
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          session_id: sessionId,
          messages: [],
          guideline_usage: {}
        })
        .select()
        .single();

      if (createError) {
        // Handle duplicate key error (race condition)
        if (createError.code === '23505') {
          // Try to get the conversation again
          const { data: existingAfterRace, error: reFetchError } = await supabase
            .from('conversations')
            .select('*')
            .eq('session_id', sessionId)
            .single();

          if (existingAfterRace && !reFetchError) {
            return existingAfterRace;
          }
          
          // If still can't get it, throw the original error
          throw reFetchError || createError;
        }
        
        throw createError;
      }

      return newConversation;
    } catch (error) {
      console.error('Error in createOrGetConversation:', error);
      throw new Error(`Failed to create or get conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addMessage(
    conversationId: number, 
    message: StoredMessage, 
    guidelineIds: number[]
  ): Promise<void> {
    try {
      // Get current conversation
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select('messages, guideline_usage')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        throw new Error('Conversation not found');
      }

      // Add new message to history
      const messages = [...(conversation.messages || []), message];
      
      // Limit history to last N messages
      const limitedMessages = messages.slice(-this.maxHistorySize);

      // Update guideline usage counts
      const guidelineUsage = conversation.guideline_usage || {};
      guidelineIds.forEach(id => {
        guidelineUsage[id] = (guidelineUsage[id] || 0) + 1;
      });

      // Update conversation
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          messages: limitedMessages,
          guideline_usage: guidelineUsage,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error(`Failed to add message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRecentMessages(conversationId: number, limit: number = 3): Promise<StoredMessage[]> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('messages')
        .eq('id', conversationId)
        .single();

      if (error || !data) {
        return [];
      }

      const messages = data.messages as StoredMessage[];
      return messages.slice(-limit);
    } catch (error) {
      console.error('Error getting recent messages:', error);
      return [];
    }
  }

  async getGuidelineUsage(conversationId: number): Promise<Record<number, number>> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('guideline_usage')
        .eq('id', conversationId)
        .single();

      if (error || !data) {
        return {};
      }

      return data.guideline_usage || {};
    } catch (error) {
      console.error('Error getting guideline usage:', error);
      return {};
    }
  }

  // Legacy method for compatibility - converts usage object to ID array
  async getUsedGuidelineIds(conversationId: number): Promise<number[]> {
    const usage = await this.getGuidelineUsage(conversationId);
    return Object.keys(usage).map(id => parseInt(id));
  }

  async recordGuidelineUsage(
    conversationId: number,
    guidelineId: number,
    score: number,
    applied: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('guideline_usage')
        .insert({
          conversation_id: conversationId,
          guideline_id: guidelineId,
          score,
          applied
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error recording guideline usage:', error);
      // Non-critical error, don't throw
    }
  }
}