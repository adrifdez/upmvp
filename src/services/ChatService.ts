import { openai, DEFAULT_MODEL } from '../config/openai.js';
import { SYSTEM_PROMPT, LLM_CONFIG, GUIDELINE_CONFIG, GUIDELINE_CATEGORIES, GUIDELINE_TITLES, buildGuidelinePrompt } from '../config/constants.js';
import type { Guideline, ChatMessage, StoredMessage, MatchScore, IMatchingService } from '../types/index.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { GuidelineService } from './GuidelineService';
import { ConversationService } from './ConversationService';

export class ChatService {
  private baseSystemPrompt = SYSTEM_PROMPT;

  constructor(
    private guidelineService: GuidelineService,
    private matchingService: IMatchingService,
    private conversationService: ConversationService
  ) {}

  buildSystemPrompt(guidelines: Guideline[], basePrompt: string = this.baseSystemPrompt): string {
    if (!guidelines || guidelines.length === 0) {
      return basePrompt;
    }

    // Agrupar guidelines por categoría
    const guidelinesByCategory = guidelines.reduce((acc, g) => {
      const category = g.category || GUIDELINE_CATEGORIES.GENERAL;
      if (!acc[category]) acc[category] = [];
      acc[category].push(g);
      return acc;
    }, {} as Record<string, Guideline[]>);

    const ventasGuidelines = guidelinesByCategory[GUIDELINE_CATEGORIES.VENTAS] || [];
    const gestionGuidelines = guidelinesByCategory[GUIDELINE_CATEGORIES.GESTION] || [];
    const generalGuidelines = guidelinesByCategory[GUIDELINE_CATEGORIES.GENERAL] || [];

    const guidelineInstructions = [
      ...(ventasGuidelines.length > 0 ? [
        GUIDELINE_TITLES[GUIDELINE_CATEGORIES.VENTAS],
        ...ventasGuidelines.map((g, index) => 
          `${index + 1}. ${g.condition.charAt(0).toUpperCase() + g.condition.slice(1)}: ${g.action}`
        ),
        ''
      ] : []),
      ...(gestionGuidelines.length > 0 ? [
        GUIDELINE_TITLES[GUIDELINE_CATEGORIES.GESTION],
        ...gestionGuidelines.map((g, index) => 
          `${index + 1}. ${g.condition.charAt(0).toUpperCase() + g.condition.slice(1)}: ${g.action}`
        ),
        ''
      ] : []),
      ...(generalGuidelines.length > 0 ? [
        GUIDELINE_TITLES[GUIDELINE_CATEGORIES.GENERAL],
        ...generalGuidelines.map((g, index) => 
          `${index + 1}. ${g.condition.charAt(0).toUpperCase() + g.condition.slice(1)}: ${g.action}`
        )
      ] : [])
    ].join('\n');
    
    return buildGuidelinePrompt(basePrompt, guidelineInstructions);
  }

  async generateResponse(
    systemPrompt: string, 
    userMessage: string,
    contextMessages: ChatMessage[] = []
  ): Promise<string> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...contextMessages.map(msg => ({ 
          role: msg.role, 
          content: msg.content 
        } as ChatCompletionMessageParam)),
        { role: 'user', content: userMessage }
      ];

      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: messages,
        temperature: LLM_CONFIG.temperature,
        max_tokens: LLM_CONFIG.maxTokens,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response generated from LLM');
      }

      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processMessage(sessionId: string, message: string, hybridWeight?: number) {
    try {
      // Create or get conversation
      const conversation = await this.conversationService.createOrGetConversation(sessionId);
      
      // Get recent messages for context
      const recentMessages = await this.conversationService.getRecentMessages(conversation.id, GUIDELINE_CONFIG.recentMessagesContext);
      
      // Get guideline usage counts
      const guidelineUsage = await this.conversationService.getGuidelineUsage(conversation.id);
      
      // Check cache first
      const cachedGuidelines = this.matchingService.getCachedGuidelines(sessionId);
      const allGuidelines = cachedGuidelines || await (async () => {
        // Get active guidelines from database
        const guidelines = await this.guidelineService.getActiveGuidelines();
        // Cache guidelines for this session
        this.matchingService.setCachedGuidelines(sessionId, guidelines);
        return guidelines;
      })()
      
      // Clear expired cache periodically
      this.matchingService.clearExpiredCache();
      
      // Find matching guidelines with context-aware scoring
      const rankedGuidelines = await this.getRankedGuidelines(
        allGuidelines,
        message,
        sessionId,
        recentMessages,
        hybridWeight
      );
      const matchedWithScores = rankedGuidelines.filter(score => score.matched);
      
      // Apply fatigue factor and get top guidelines
      const guidelinesWithFatigue = matchedWithScores.map(score => {
        const usageCount = guidelineUsage[score.guideline.id] || 0;
        const fatigueMultiplier = Math.pow(GUIDELINE_CONFIG.fatigueFactor, usageCount);
        return {
          ...score,
          originalScore: score.score,
          score: score.score * fatigueMultiplier,
          usageCount
        };
      });
      
      // Sort by adjusted score and get top guidelines
      const newGuidelinesWithScores = guidelinesWithFatigue
        .sort((a, b) => b.score - a.score)
        .slice(0, GUIDELINE_CONFIG.maxGuidelinesPerResponse);
      
      const newGuidelines = newGuidelinesWithScores.map(score => score.guideline);

      
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(newGuidelines);
      // Generate response with context
      const response = await this.generateResponse(
        systemPrompt, 
        message, 
        recentMessages.map(m => ({ role: m.role, content: m.content }))
      );
      
      // Store user message
      const userMessage: StoredMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      await this.conversationService.addMessage(
        conversation.id,
        userMessage,
        []
      );
      
      // Store assistant response
      const assistantMessage: StoredMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        guidelines_used: newGuidelines.map(g => g.id)
      };
      
      await this.conversationService.addMessage(
        conversation.id,
        assistantMessage,
        newGuidelines.map(g => g.id)
      );
      
      // Record guideline usage with actual scores
      await Promise.all(
        newGuidelinesWithScores.map(guidelineWithScore =>
          this.conversationService.recordGuidelineUsage(
            conversation.id,
            guidelineWithScore.guideline.id,
            guidelineWithScore.score,
            true
          )
        )
      );
      
      return {
        response,
        guidelines_used: newGuidelines.map(g => ({
          id: g.id,
          condition: g.condition,
          action: g.action,
          score: newGuidelinesWithScores.find(gs => gs.guideline.id === g.id)?.score,
          usageCount: newGuidelinesWithScores.find(gs => gs.guideline.id === g.id)?.usageCount
        })),
        session_id: sessionId,
        conversation_id: conversation.id,
        detected_category: this.matchingService.detectMessageCategory(message)
      };
    } catch (error) {
      console.error('Error in processMessage:', error);
      throw error;
    }
  }

  private async getRankedGuidelines(
    availableGuidelines: Guideline[],
    message: string,
    sessionId: string,
    recentMessages: StoredMessage[],
    hybridWeight?: number
  ): Promise<MatchScore[]> {
    return this.matchingService.rankGuidelinesWithVectorContext
      ? await this.matchingService.rankGuidelinesWithVectorContext(
          availableGuidelines,
          message,
          sessionId,
          recentMessages,
          hybridWeight
        )
      : await Promise.resolve(
          this.matchingService.rankGuidelinesWithContext(
            availableGuidelines,
            message,
            recentMessages
          )
        );
  }
}