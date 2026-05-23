import { ExpressAdapter } from '@nestjs/platform-express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { SchedulerModule } from './scheduler.module';
import { setupApp } from 'libs/utils/setup-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    SchedulerModule,
    new ExpressAdapter(),
    {
      bufferLogs: true,
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    },
  );
  const name = 'api-scheduler';
  await setupApp(name, app, { trustProxy: false });
}
bootstrap();
