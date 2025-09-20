import { SchedulerModule } from './scheduler.module';
import { setupApp } from 'libs/utils/setup-app';

async function bootstrap() {
  const name = 'api-scheduler';
  await setupApp(name, SchedulerModule);
}
bootstrap();
