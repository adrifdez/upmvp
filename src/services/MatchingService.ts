import type { Guideline, MatchScore, StoredMessage, IMatchingService } from '../types/index.js';
import { 
  CATEGORY_PATTERNS,
  CONVERSATION_FLOWS,
  CACHE_TTL,
  SPANISH_VERB_PATTERNS,
  SPANISH_ACTION_WORDS,
  SPANISH_COMMON_WORDS,
  SPANISH_CONDITION_CLEANERS
} from '../config/constants.js';

interface CachedGuidelines {
  guidelines: Guideline[];
  timestamp: number;
}

export class MatchingService implements IMatchingService {
  private guidelineCache: Map<string, CachedGuidelines> = new Map();
  
  getCategoryPatterns() {
    return CATEGORY_PATTERNS;
  }
  
  getConversationFlows() {
    return CONVERSATION_FLOWS;
  }
  calculateScore(userMessage: string, guideline: Guideline): number {
    const lowerMessage = userMessage.toLowerCase();
    const lowerCondition = guideline.condition.toLowerCase();
    
    let score = 0;
    let cleanCondition = lowerCondition;

    for (const { pattern, replacement } of SPANISH_CONDITION_CLEANERS) {
      cleanCondition = cleanCondition.replace(pattern, replacement);
    }
    cleanCondition = cleanCondition.trim();
    
    
    for (const { pattern, score: patternScore } of SPANISH_VERB_PATTERNS) {
      const match = cleanCondition.match(pattern);
      if (match && match[1]) {
        const keyWord = match[1];
        if (lowerMessage.includes(keyWord)) {
          score += patternScore;
          break; // Only match one pattern
        }
      }
    }
    
    // Exact match check
    if (lowerMessage === cleanCondition) {
      return 100;
    }
    
    // Check if cleaned condition is contained in message
    if (lowerMessage.includes(cleanCondition)) {
      score += 70;
    }
    
    
    for (const [key, synonyms] of Object.entries(SPANISH_ACTION_WORDS)) {
      if (cleanCondition.includes(key)) {
        for (const synonym of synonyms) {
          if (lowerMessage.includes(synonym)) {
            score += 40;
            break;
          }
        }
      }
    }
    
    // Word-based matching
    const messageWords = lowerMessage.split(/\s+/);
    const conditionWords = cleanCondition.split(/\s+/);
    
    
    const matchedWords = conditionWords
      .filter(condWord => !SPANISH_COMMON_WORDS.includes(condWord))
      .filter(condWord => 
        messageWords.some(msgWord => {
          // Exact match
          if (msgWord === condWord) return true;
          
          // Only check partial matches for words longer than 3 characters
          // to avoid false positives like "o" in "hello" matching "o" in "competitor"
          if (condWord.length > 3 && msgWord.length > 3) {
            return msgWord.includes(condWord) || condWord.includes(msgWord);
          }
          
          return false;
        })
      ).length;
    
    const significantWords = conditionWords.filter(w => !SPANISH_COMMON_WORDS.includes(w)).length;
    
    if (significantWords > 0) {
      score += (matchedWords / significantWords) * 30;
    }
    
    // Priority boost
    score += guideline.priority * 0.5;
    
    return Math.min(score, 100);
  }

  rankGuidelines(guidelines: Guideline[], userMessage: string): MatchScore[] {
    const scores: MatchScore[] = guidelines.map(guideline => {
      const score = this.calculateScore(userMessage, guideline);
      return {
        guideline,
        score,
        matched: score > 30
      };
    });
    
    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  filterUsedGuidelines(guidelines: Guideline[], usedIds: number[]): Guideline[] {
    if (!usedIds || usedIds.length === 0) {
      return guidelines;
    }
    
    return guidelines.filter(g => !usedIds.includes(g.id));
  }

  checkBasicRelationships(guidelines: Guideline[]): Guideline[] {
    // For MVP, we'll just return top 3 guidelines
    // In future phases, this could check for conflicts, dependencies, etc.
    return guidelines.slice(0, 3);
  }

  findMatchingGuidelines(
    userMessage: string, 
    guidelines: Guideline[]
  ): Guideline[] {
    // Get scores for all guidelines
    const ranked = this.rankGuidelines(guidelines, userMessage);
    
    // Filter out guidelines with low scores and get only matched ones
    const matched = ranked
      .filter(score => score.matched)
      .map(score => score.guideline);
    
    // Apply basic relationship checks (returns top 3 for MVP)
    const finalGuidelines = this.checkBasicRelationships(matched);
    
    return finalGuidelines;
  }

  detectMessageCategory(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      for (const pattern of patterns) {
        if (lowerMessage.includes(pattern)) {
          return category;
        }
      }
    }
    
    return null;
  }

  calculateContextBonus(
    guideline: Guideline, 
    previousMessages: StoredMessage[]
  ): number {
    let bonus = 0;
    
    // Check if guideline category matches previous message categories
    if (guideline.category && previousMessages.length > 0) {
      const recentCategories = previousMessages
        .slice(-3) // Look at last 3 messages
        .map(msg => this.detectMessageCategory(msg.content))
        .filter(Boolean);
      
      if (recentCategories.includes(guideline.category)) {
        bonus += 15; // Category continuity bonus
      }
    }
    
    // Check for conversation flows
    if (previousMessages.length > 0) {
      const lastMessage = previousMessages[previousMessages.length - 1];
      if (lastMessage) {
        const lastCategory = this.detectMessageCategory(lastMessage.content);
        const currentCategory = guideline.category;
        
        if (lastCategory && currentCategory) {
          for (const flow of CONVERSATION_FLOWS) {
            if (flow.from === lastCategory && flow.to === currentCategory) {
              bonus += flow.boost;
              break;
            }
          }
        }
      }
    }
    
    return bonus;
  }

  calculateScoreWithContext(
    userMessage: string, 
    guideline: Guideline,
    previousMessages: StoredMessage[] = []
  ): number {
    // Calculate base score
    const baseScore = this.calculateScore(userMessage, guideline);
    
    // Calculate context bonus
    const contextBonus = this.calculateContextBonus(guideline, previousMessages);
    
    // Return combined score (capped at 100)
    return Math.min(baseScore + contextBonus, 100);
  }

  rankGuidelinesWithContext(
    guidelines: Guideline[], 
    userMessage: string,
    previousMessages: StoredMessage[] = []
  ): MatchScore[] {
    const scores: MatchScore[] = guidelines.map(guideline => {
      const score = this.calculateScoreWithContext(userMessage, guideline, previousMessages);
      return {
        guideline,
        score,
        matched: score > 30
      };
    });
    
    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  getCachedGuidelines(sessionId: string): Guideline[] | null {
    const cached = this.guidelineCache.get(sessionId);
    
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.guidelineCache.delete(sessionId);
      return null;
    }
    
    return cached.guidelines;
  }

  setCachedGuidelines(sessionId: string, guidelines: Guideline[]): void {
    this.guidelineCache.set(sessionId, {
      guidelines,
      timestamp: Date.now()
    });
  }

  clearExpiredCache(): void {
    const now = Date.now();
    Array.from(this.guidelineCache.entries())
      .filter(([_, cached]) => now - cached.timestamp > CACHE_TTL)
      .forEach(([sessionId]) => this.guidelineCache.delete(sessionId));
  }
}