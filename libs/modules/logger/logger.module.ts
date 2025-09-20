import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: LoggerService,
      useFactory: () => {
        const logger = new LoggerService();
        logger.connect('trace');
        return logger;
      },
    },
  ],
  exports: [LoggerService],
})
export class LoggerModule {}
