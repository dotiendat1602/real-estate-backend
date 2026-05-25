import { HttpStatus, Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { ApiException } from "libs/utils/exception";
import { CoreConfigService } from "../../config/core-config.service";

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
  failedDocuments?: number;
  items: Array<{
    planningDocumentId: number;
    title: string;
    deletedChunks: number;
    ingestedChunks: number;
    textChunks: number;
    tableChunks: number;
    skipped?: boolean;
    reason?: string | null;
    error?: string | null;
  }>;
}

@Injectable()
export class PlanningAiClientService {
  private readonly client: AxiosInstance;
  private readonly ingestTimeout: number;
  private readonly ingestRetries: number;

  constructor(private readonly coreConfigService: CoreConfigService) {
    const baseURL = this.coreConfigService.aiService.url;
    const configuredIngestTimeout = Number(this.coreConfigService.aiService.ingestTimeout || 0);
    // 0 means no client-side timeout; use for long-running async ingest jobs.
    this.ingestTimeout = Number.isFinite(configuredIngestTimeout) && configuredIngestTimeout >= 0
      ? configuredIngestTimeout
      : 0;
    this.ingestRetries = Math.max(0, this.coreConfigService.aiService.ingestRetries || 0);

    this.client = axios.create({
      baseURL,
      timeout: this.coreConfigService.aiService.timeout,
    });
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
      const statusCode = Number(lastError?.response?.status) || null;
      const errorCode = lastError?.code || null;

      if (errorCode === "ECONNABORTED") {
        throw new ApiException(
          `AI service ingest timeout sau ${this.ingestTimeout}ms`,
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }

      if (statusCode !== null && statusCode >= 500) {
        throw new ApiException(
          "AI service loi noi bo khi ingest tai lieu quy hoach: " + (lastError?.response?.data || lastError.message || "Unknown error"),
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new ApiException(
        "Khong the ket noi AI service de ingest tai lieu quy hoach: " + (lastError?.response?.data || lastError.message || "Unknown error"),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    throw new ApiException("Khong the ingest tai lieu quy hoach", HttpStatus.SERVICE_UNAVAILABLE);
  }
}
