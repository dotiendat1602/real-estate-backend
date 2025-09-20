import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CoreConfigService } from '../config/core-config.service';
import { UserModule } from '../users/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Global()
@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: CoreConfigService) => ({
        secret: configService.authentication.secret,
        global: true,
      }),
      inject: [CoreConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, TokenService],
  exports: [AuthService, JwtStrategy, JwtRefreshStrategy, TokenService],
})
export class AuthModule {}
