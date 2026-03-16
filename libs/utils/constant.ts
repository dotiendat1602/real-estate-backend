export interface AIChatRequest {
  userId?: number;
  sessionId?: number;
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
  planningContexts?: PlanningChatContext[];
}

export interface PlanningChatContext {
  propertyId: number;
  planningStatus: string;
  riskLevel?: string | null;
  landUseCurrent?: string | null;
  landUsePlanned?: string | null;
  dossierCode?: string | null;
  dossierName?: string | null;
  checkedAt?: string | null;
  reportSummaries?: Array<{
    title: string;
    docType?: string | null;
    format?: string | null;
    sourcePath?: string | null;
    sourceUrl?: string | null;
    rawMeta?: Record<string, any> | null;
  }>;
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
