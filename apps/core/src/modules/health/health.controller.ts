import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Heath')
@Controller('/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  health() {
    return this.healthService.health();
  }
}
