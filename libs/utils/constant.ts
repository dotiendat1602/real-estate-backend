export interface AIChatRequest {
  userId?: number;
  message: string;
  filters?: {
    city?: string;
    district?: string;
    postType?: string;
    priceMin?: number;
    priceMax?: number;
    areaMin?: number;
    areaMax?: number;
    bedrooms?: number;
    [key: string]: any;
  };
  topK?: number;
}

export interface AICitation {
  postId: number;
  score?: number;
  metadata?: Record<string, any>;
  snippet: string;
}

export interface AIChatResponse {
  answer: string;
  citations: AICitation[];
}
