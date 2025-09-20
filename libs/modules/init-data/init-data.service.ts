import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CoreConfigService } from 'apps/core/src/modules/config/core-config.service';
import { AuthService } from 'apps/core/src/modules/auth/services/auth.service';

@Injectable()
export class InitDataService {
  constructor(
    private readonly configService: CoreConfigService,
    private readonly authService: AuthService,
  ) {}

  async initCore() {
    await this.initAdmin();
    return;
  }

  async initAdmin() {
    const existingUser = await this.authService.getUserByEmail(
      this.configService.authentication.adminEmail,
    );

    if (existingUser) {
      return;
    }

    await this.authService.register(
      {
        email: this.configService.authentication.adminEmail,
        name: 'Admin',
        password: this.configService.authentication.adminPassword,
      },
      { isAdmin: true },
    );
  }
}
