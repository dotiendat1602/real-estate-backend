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
    title: string;
    format: string | null;
    docType?: string | null;
    sourcePath?: string | null;
    rawMeta?: Record<string, any> | null;
  }>;
}

export interface PlanningAiExplainResponse {
  answer: string;
  disclaimer: string;
  highlights: string[];
}

@Injectable()
export class PlanningAiClientService {
  private readonly client: AxiosInstance;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(private readonly coreConfigService: CoreConfigService) {
    const baseURL = this.coreConfigService.aiService.url;
    this.timeout = this.coreConfigService.aiService.timeout;
    this.retries = Math.max(0, this.coreConfigService.aiService.retries || 0);

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
}
