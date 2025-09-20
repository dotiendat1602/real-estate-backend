import { Module } from '@nestjs/common';
import { InitDataService } from './init-data.service';
import { AuthModule } from 'apps/core/src/modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [InitDataService],
  exports: [InitDataService],
})
export class InitDataModule {}
