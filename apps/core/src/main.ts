import { setupApp } from 'libs/utils/setup-app';
import { CoreModule } from './core.module';
import { Services } from 'libs/utils/enum';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    CoreModule,
    new ExpressAdapter(),
    {
      bufferLogs: true,
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
      cors: true,
    },
  );
  await setupApp(Services.API_CORE, app);
}
bootstrap();
