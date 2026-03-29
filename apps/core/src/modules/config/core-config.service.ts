import { Injectable } from '@nestjs/common';
import { ConfigService } from 'libs/modules/config/config.service';

@Injectable()
export class CoreConfigService extends ConfigService {
  authentication = {
    secret: this.getOrThrow('AUTH_SECRET_KEY'),
    accessExpireTime: +this.get('AUTH_ACCESS_EXP_TIME') || 86400,
    refreshExpireTime: +this.get('AUTH_REFRESH_EXP_TIME') || 86400,
    adminEmail: this.get('ADMIN_EMAIL'),
    adminPassword: this.get('ADMIN_PASSWORD'),
  };

  database = {
    url: this.getOrThrow('DATABASE_URL'),
  };

  aiService = {
    url: this.get('AI_SERVICE_URL') || 'http://localhost:8001',
    timeout: +this.get('AI_SERVICE_TIMEOUT') || 30000,
    retries: +this.get('AI_SERVICE_RETRIES') || 2,
    ingestTimeout: +this.get('AI_SERVICE_INGEST_TIMEOUT') || 300000,
    ingestRetries: +this.get('AI_SERVICE_INGEST_RETRIES') || 0,
  }
}
