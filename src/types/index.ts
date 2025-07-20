export interface Guideline {
  id: number;
  condition: string;
  action: string;
  priority: number;
  active: boolean;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface GuidelineInput {
  condition: string;
  action: string;
  priority?: number;
  active?: boolean;
  category?: string;
}

export interface GuidelineUsage {
  id: number;
  guideline_id: number;
  score: number;
  applied: boolean;
  created_at: string;
  guidelines?: {
    id: number;
    condition: string;
    action: string;
    category?: string;
    priority: number;
  };
}

export interface GuidelineStatistics {
  totalUsages: number;
  uniqueGuidelines: number;
  averageScore: number;
  appliedCount: number;
  applicationRate?: number;
  topGuidelines: {
    guidelineId: number;
    count: number;
    guideline: {
      condition: string;
      action: string;
      category?: string;
    } | null;
  }[];
  usagesByCategory: Record<string, number>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  guidelinesUsed: string[];
  sessionId?: string;
}

export interface MatchScore {
  guideline: Guideline;
  score: number;
  matched: boolean;
}

export interface Conversation {
  id: number;
  session_id: string;
  messages: ChatMessage[];
  used_guideline_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface StoredMessage extends ChatMessage {
  timestamp: string;
  guidelines_used?: number[];
}

export interface IMatchingService {
  calculateScore(userMessage: string, guideline: Guideline): number;
  rankGuidelines(guidelines: Guideline[], userMessage: string): MatchScore[];
  filterUsedGuidelines(guidelines: Guideline[], usedIds: number[]): Guideline[];
  checkBasicRelationships(guidelines: Guideline[]): Guideline[];
  findMatchingGuidelines(userMessage: string, guidelines: Guideline[]): Guideline[];
  detectMessageCategory(message: string): string | null;
  calculateContextBonus(guideline: Guideline, previousMessages: StoredMessage[]): number;
  calculateScoreWithContext(userMessage: string, guideline: Guideline, previousMessages?: StoredMessage[]): number;
  rankGuidelinesWithContext(guidelines: Guideline[], userMessage: string, previousMessages?: StoredMessage[]): MatchScore[] | Promise<MatchScore[]>;
  getCachedGuidelines(sessionId: string): Guideline[] | null;
  setCachedGuidelines(sessionId: string, guidelines: Guideline[]): void;
  clearExpiredCache(): void;
  // Optional async method for vector matching
  rankGuidelinesWithVectorContext?(
    guidelines: Guideline[], 
    userMessage: string,
    sessionId: string,
    previousMessages?: StoredMessage[],
    hybridWeight?: number
  ): Promise<MatchScore[]>;
}