export interface AIChatRequest {
  userId?: number;
  sessionId?: number;
  message: string;
}

export interface AICitation {
  postId: number;
  score?: number;
  metadata?: Record<string, any>;
  snippet: string;
}

export interface AIChatResponse {
  answer: string;
  sessionId?: number;
  citations: AICitation[];
}
