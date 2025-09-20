import { Injectable } from '@nestjs/common';
import { PrismaHealthIndicator } from 'libs/modules/prisma/prisma-health.indicator';

@Injectable()
export class HealthService {
  constructor(private readonly prismaIndicator: PrismaHealthIndicator) {}
  async health() {
    return this.prismaIndicator.isHealthy('key');
  }
}
