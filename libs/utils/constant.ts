export interface AIChatRequest {
  userId?: number;
  sessionId?: number;
  postId?: number;
  message: string;
}

export interface AICitation {
  postId?: number | null;
  propertyId?: number | null;
  sourceUrl?: string | null;
  title?: string | null;
  postTitle?: string | null;
  score?: number;
  metadata?: Record<string, any>;
  snippet?: string | null;
  [key: string]: any;
}

export interface AIChatResponse {
  answer: string;
  sessionId?: number;
  citations: AICitation[];
}
