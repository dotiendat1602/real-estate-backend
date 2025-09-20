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
}
