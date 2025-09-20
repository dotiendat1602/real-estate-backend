import { Injectable, OnModuleInit } from '@nestjs/common';
import Redlock from 'redlock';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedlockService implements OnModuleInit {
  private redlock: Redlock;
  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const client = new Redis({
      host: this.configService.redis.host,
      port: this.configService.redis.port,
      db: this.configService.redis.db,
      username: this.configService.redis.username,
      password: this.configService.redis.password,
    });
    this.redlock = new Redlock([client], {
      driftFactor: 0.01, // multiplied by lock ttl to determine drift time
      retryCount: 10,
      retryDelay: 200, // time in ms
      retryJitter: 200, // time in ms
      automaticExtensionThreshold: 500, // time in ms
    });
  }

  getClient() {
    return this.redlock;
  }
}
