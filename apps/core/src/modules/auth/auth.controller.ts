import { Body, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { User } from '@prisma/client';
import { Auth, AuthRefreshToken } from 'libs/utils';
import { CoreControllers } from 'libs/utils/decorators/controller-customer.decorator';
import { ApiResponseCustom } from 'libs/utils/decorators/response-customer.decorator';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { responseSuccessBasic } from 'libs/utils/schema';
import { CoreUserRegisterDto } from './dto/register.dto';
import { AuthService } from './services/auth.service';
import {
  responseLoginSuccess,
  responseRegisterFail,
  responseRegisterSuccess,
} from './response/schema';
import { CoreUserLoginDto } from './dto/login.dto';

@CoreControllers({
  path: 'auth',
  version: '1',
  tag: 'Auth',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiResponseCustom([responseRegisterSuccess, responseRegisterFail])
  async register(@Body() body: CoreUserRegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiResponseCustom([responseLoginSuccess])
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: CoreUserLoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @AuthRefreshToken()
  @HttpCode(HttpStatus.OK)
  async refreshToken() {
    const user = ContextProvider.getAuthUser<User>();

    return this.authService.generateNewToken(user, true);
  }
}
