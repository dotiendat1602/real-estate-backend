import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { CacheModule } from 'libs/modules/cache/cache.module';
import { ClsModule } from 'libs/modules/cls/cls.module';
import { ConfigModule } from 'libs/modules/config/config.module';
import { LoggerModule } from 'libs/modules/logger/logger.module';
import { PrismaModule } from 'libs/modules/prisma/prisma.module';
import { QueueModule } from 'libs/modules/queue/queue.module';
import { RedlockModule } from 'libs/modules/redlock/redlock.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoreConfigService } from './modules/config/core-config.service';
import { HealthModule } from './modules/health/health.module';
import { UserModule } from './modules/users/user.module';
import { LogActionMiddleware } from 'libs/utils/middlewares/log-action.middleware';
import { InitDataModule } from 'libs/modules/init-data/init-data.module';
import { PropertyCategoryModule } from './modules/property-category/property-category.module';
import { PropertyModule } from './modules/property/property.module';
import { AmenityModule } from './modules/amenity/amenity.module';
import { PropertyUtilityModule } from './modules/property-utility/property-utility.module';
import { LocationModule } from './modules/locations/location.module';
import { PostModule } from './modules/post/post.module';
import { AppointmentModule } from './modules/appoitment/appointment.module';
import { DepositModule } from './modules/deposit/deposit.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';

const applications = [
  HealthModule,
  AuthModule,
  UserModule,
  PropertyCategoryModule,
  PropertyModule,
  AmenityModule,
  PropertyUtilityModule,
  LocationModule,
  PostModule,
  AppointmentModule,
  DepositModule,
  AuthorizationModule,
];

@Module({
  imports: [
    InitDataModule,
    LoggerModule,
    ConfigModule.register({
      envFilePath: './apps/core/.env',
      provider: [CoreConfigService],
      exports: [CoreConfigService],
    }),
    ClsModule,
    // CacheModule,
    // RedlockModule,
    // QueueModule,
    PrismaModule.forRootAsync({
      isGlobal: true,
      useFactory: () => {
        return {
          prismaOptions: {
            log: ['error'],
          },
        };
      },
    }),
    ...applications,
  ],
})
export class CoreModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LogActionMiddleware).forRoutes('*');
  }
}
