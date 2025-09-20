import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { LoggerModule } from 'libs/modules/logger/logger.module';
import { ConfigModule } from 'libs/modules/config/config.module';
import { ClsModule } from 'libs/modules/cls/cls.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.register({
      envFilePath: './apps/scheduler/.env',
    }),
    ClsModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
