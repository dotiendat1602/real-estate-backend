import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaServiceOptions } from './prisma.interface';
import { PRISMA_SERVICE_OPTIONS } from './prisma.constant';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(PRISMA_SERVICE_OPTIONS)
    private readonly prismaServiceOptions: PrismaServiceOptions = {},
  ) {
    super(prismaServiceOptions.prismaOptions as any);
  }

  async onModuleInit() {
    if (this.prismaServiceOptions.explicitConnect) {
      await this.$connect();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
