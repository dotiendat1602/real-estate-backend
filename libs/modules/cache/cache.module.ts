import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        errorLog: true,
        config: {
          host: configService.redis.host,
          port: configService.redis.port,
          db: configService.redis.db,
          username: configService.redis.username,
          password: configService.redis.password,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CacheModule {}
