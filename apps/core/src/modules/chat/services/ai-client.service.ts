import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { CoreConfigService } from '../../config/core-config.service';
import { AIChatRequest, AIChatResponse } from 'libs/utils/constant';

@Injectable()
export class AIClientService {
  private readonly logger = new Logger(AIClientService.name);
  private readonly aiServiceUrl: string;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: CoreConfigService,
  ) {
    this.aiServiceUrl = this.configService.aiService.url;
    this.timeout = this.configService.aiService.timeout;
    this.retries = this.configService.aiService.retries;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const url = `${this.aiServiceUrl}/api/chat`;

    this.logger.debug(`Calling AI service: ${url}`);
    this.logger.debug(`Request: ${JSON.stringify(request)}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post<AIChatResponse>(url, request).pipe(
          timeout(this.timeout),
          catchError((error: AxiosError) => {
            this.logger.error(`AI service error: ${error.message}`, error.stack);

            if (error.code === 'ECONNREFUSED') {
              throw new ServiceUnavailableException(
                'AI service is not available. Please try again later.',
              );
            }

            if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
              throw new ServiceUnavailableException(
                'AI service request timeout. Please try again.',
              );
            }

            const status = error.response?.status;
            const message = error.message;

            if (status === 400) {
              throw new ServiceUnavailableException(`Invalid request to AI service: ${message}`);
            }

            if (status === 500) {
              throw new ServiceUnavailableException(`AI service internal error: ${message}`);
            }

            throw new ServiceUnavailableException(
              `Failed to communicate with AI service: ${message}`,
            );
          }),
        ),
      );

      this.logger.debug(`AI response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      // Re-throw if already handled
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error(`Unexpected error calling AI service: ${error.message}`, error.stack);
      throw new ServiceUnavailableException(
        'An unexpected error occurred while communicating with AI service.',
      );
    }
  }

  /**
   * Health check cho AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.aiServiceUrl}/health`;
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(timeout(5000)),
      );
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`AI service health check failed: ${error.message}`);
      return false;
    }
  }
}
