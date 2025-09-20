import { HttpStatus, Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { ErrorCode } from 'libs/utils/enum';
import { ApiException } from 'libs/utils/exception';
import { generateHash, validateHash } from 'libs/utils/util';
import { CoreUserLoginDto } from '../dto/login.dto';
import { CoreUserRegisterDto } from '../dto/register.dto';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
  ) {}

  async getUserByEmail(email: string) {
    return this.prismaService.user.findFirst({ where: { email } });
  }
  async register(
    body: CoreUserRegisterDto,
    optional?: {
      isAdmin?: boolean;
    },
  ) {
    const existingUser = await this.getUserByEmail(body.email);

    if (existingUser) {
      throw new ApiException(
        'User existing',
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_INPUT,
      );
    }

    const hashedPassword = generateHash(body.password);

    const newUser = await this.prismaService.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: optional?.isAdmin ? Role.ADMIN : Role.USER,
      },
    });

    return this.tokenService.signToken(newUser);
  }

  async login(body: CoreUserLoginDto) {
    const user = await this.getUserByEmail(body.email);

    if (!user) {
      throw new ApiException(
        'User not found',
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    const isMathPassword = await validateHash(body.password, user.password);

    if (!isMathPassword) {
      throw new ApiException(
        'Email or password not matching',
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    return this.tokenService.signToken(user);
  }

  async generateNewToken(user: User, isAccessToken = false) {
    return this.tokenService.signToken(user, isAccessToken);
  }
}
