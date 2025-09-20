import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';

@Module({
  providers: [HealthService],
  controllers: [HealthController],
  imports: [TerminusModule],
})
export class HealthModule {}
