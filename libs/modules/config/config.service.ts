import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

@Injectable()
export class ConfigService extends NestConfigService {
  constructor() {
    super();
  }

  application = {
    NODE_ENV: this.getOrThrow('NODE_ENV'),
    PORT: +this.getOrThrow<number>('PORT'),
    ADMIN_EMAIL: this.getOrThrow<string>('ADMIN_EMAIL'),
    ADMIN_PASSWORD: this.getOrThrow<string>('ADMIN_PASSWORD'),
    ENABLE_DOCS: ['1', 'yes', 'true'].includes(this.getOrThrow('ENABLE_DOCS')),
  };

  redis = {
    host: this.getOrThrow('REDIS_HOST'),
    port: +this.getOrThrow('REDIS_PORT'),
    db: this.get<number>('REDIS_DB') ? Number(this.get<number>('REDIS_DB')) : 0,
    username: this.get('REDIS_USERNAME'),
    password: this.get('REDIS_PASSWORD'),
  };

  validateConfig<T extends object>(cls: ClassConstructor<T>, config: T): T {
    const configInstance = plainToInstance(cls, config, {});
    const errors = validateSync(configInstance);

    if (errors.length > 0) {
      const errorMessages = errors
        .map((err) => Object.values(!err.constraints))
        .join(', ');
      throw new Error(`Invalid configuration: ${errorMessages}`);
    }

    return configInstance;
  }
}
