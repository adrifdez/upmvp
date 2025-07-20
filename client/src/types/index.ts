export interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  guidelines?: MatchedGuideline[];
}

export interface Guideline {
  id: string;
  condition: string;
  action: string;
  priority: number;
  active: boolean;
  created_at?: Date;
  category?: string;
}

export interface MatchedGuideline extends Guideline {
  score: number;
  lastApplied?: Date;
  usageCount?: number;
}

export interface ChatResponse {
  response: string;
  guidelines_used?: MatchedGuideline[];
  session_id: string;
  conversation_id: number;
  detected_category: string;
}

export interface GuidelinesResponse {
  guidelines: Guideline[];
}

export interface DualChatResponse {
  text: ChatResponse | null;
  vector: ChatResponse | null;
  message: string;
  sessionId: string;
  error?: {
    text?: string;
    vector?: string;
  };
  responseTimes?: {
    text?: number;
    vector?: number;
  };
}

export interface MessageWithMethod extends Message {
  method?: 'text' | 'vector';
  responseTime?: number;
}

export interface MethodMetrics {
  timestamp: Date;
  method: 'text' | 'vector';
  responseTime: number;
  guidelinesApplied: number;
  avgScore: number;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  lastActive: Date;
  textMetrics: MethodMetrics[];
  vectorMetrics: MethodMetrics[];
  totalMessages: {
    text: number;
    vector: number;
  };
}

export interface GuidelineUsage {
  guideline: MatchedGuideline;
  useCount: number;
  totalScore: number;
  avgScore: number;
  lastUsed: Date;
  firstUsed: Date;
}