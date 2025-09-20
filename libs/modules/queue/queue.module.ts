import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.redis.host,
          port: configService.redis.port,
          username: configService.redis.username,
          password: configService.redis.password,
          db: configService.redis.db,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class QueueModule {}
