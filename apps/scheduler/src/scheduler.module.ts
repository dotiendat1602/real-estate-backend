import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { CrawlBatdongsanService } from './batdongsan-com-vn/crawl-batdongsan.service';
import { LoggerModule } from 'libs/modules/logger/logger.module';
import { ConfigModule } from 'libs/modules/config/config.module';
import { ClsModule } from 'libs/modules/cls/cls.module';
import { PrismaModule } from 'libs/modules/prisma/prisma.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule,
    ConfigModule.register({
      envFilePath: './apps/scheduler/.env',
    }),
    ClsModule,
    PrismaModule.forRootAsync({
      isGlobal: true,
      useFactory: () => ({
        prismaOptions: {
          log: ['error'],
        },
      }),
    }),
  ],
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    CrawlBatdongsanService
  ],
})
export class SchedulerModule { }
