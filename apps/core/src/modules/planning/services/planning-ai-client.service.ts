import { HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { ApiException } from "libs/utils/exception";
import { CoreConfigService } from "../../config/core-config.service";

export interface PlanningAiExplainRequest {
  propertyId: number;
  question?: string;
  summary: {
    planningStatus: string;
    riskLevel: string | null;
    landUseCurrent: string | null;
    landUsePlanned: string | null;
    dossierCode: string | null;
    dossierName: string | null;
    checkedAt: string | null;
  };
  documents: Array<{
    planningDocumentId?: number;
    title: string;
    format: string | null;
    docType?: string | null;
    sourcePath?: string | null;
    sourceUrl?: string | null;
    rawMeta?: Record<string, any> | null;
  }>;
}

export interface PlanningAiExplainResponse {
  answer: string;
  disclaimer: string;
  highlights: string[];
  citations?: Array<{
    postId?: number | null;
    propertyId?: number | null;
    planningDocumentId?: number | null;
    title?: string | null;
    sourceUrl?: string | null;
    format?: string | null;
    documentScope?: string | null;
    documentType?: string | null;
    dossierCode?: string | null;
    planYear?: number | null;
    chunkType?: string | null;
    chunkIndex?: number | null;
    globalChunkIndex?: number | null;
    pageNumber?: number | null;
    lineStart?: number | null;
    lineEnd?: number | null;
    sourceLocator?: string | null;
    chunker?: string | null;
    city?: string | null;
    district?: string | null;
    snippet?: string | null;
  }>;
}

export interface PlanningAiIngestDocumentRequest {
  planningDocumentId: number;
  title: string;
  sourceUrl: string;
  format?: string | null;
  documentType?: string | null;
  dossierCode?: string | null;
  city?: string | null;
  district?: string | null;
  planYear?: number | null;
  propertyId?: number | null;
  rawMeta?: Record<string, any> | null;
}

export interface PlanningAiIngestRequest {
  replaceExisting?: boolean;
  documents: PlanningAiIngestDocumentRequest[];
}

export interface PlanningAiIngestResponse {
  ok: boolean;
  ingestedChunks: number;
  items: Array<{
    planningDocumentId: number;
    title: string;
    deletedChunks: number;
    ingestedChunks: number;
    textChunks: number;
    tableChunks: number;
  }>;
}

@Injectable()
export class PlanningAiClientService {
  private readonly client: AxiosInstance;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly ingestTimeout: number;
  private readonly ingestRetries: number;

  constructor(private readonly coreConfigService: CoreConfigService) {
    const baseURL = this.coreConfigService.aiService.url;
    this.timeout = this.coreConfigService.aiService.timeout;
    this.retries = Math.max(0, this.coreConfigService.aiService.retries || 0);
    this.ingestTimeout = Math.max(this.timeout, this.coreConfigService.aiService.ingestTimeout || 300000);
    this.ingestRetries = Math.max(0, this.coreConfigService.aiService.ingestRetries || 0);

    this.client = axios.create({
      baseURL,
      timeout: this.timeout,
    });
  }

  async explain(request: PlanningAiExplainRequest): Promise<PlanningAiExplainResponse> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.client.post<PlanningAiExplainResponse>("/api/planning/explain", request);
        return response.data;
      } catch (error: any) {
        lastError = error;
      }
    }

    if (lastError) {
      throw new ApiException(
        "Không thể kết nối AI service để phân tích quy hoạch",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new ApiException("Không thể phân tích quy hoạch", HttpStatus.SERVICE_UNAVAILABLE);
  }

  async ingestDocuments(request: PlanningAiIngestRequest): Promise<PlanningAiIngestResponse> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.ingestRetries; attempt += 1) {
      try {
        const response = await this.client.post<PlanningAiIngestResponse>(
          "/api/planning/ingest-documents",
          request,
          { timeout: this.ingestTimeout },
        );
        return response.data;
      } catch (error: any) {
        lastError = error;
      }
    }

    if (lastError) {
      throw new ApiException(
        "Khong the ket noi AI service de ingest tai lieu quy hoach",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new ApiException("Khong the ingest tai lieu quy hoach", HttpStatus.SERVICE_UNAVAILABLE);
  }
}
