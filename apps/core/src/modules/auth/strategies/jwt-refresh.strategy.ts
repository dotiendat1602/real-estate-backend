import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ApiException } from 'libs/utils/exception';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { TokenType } from 'libs/utils/enum';
import { Role } from '@prisma/client';
import { CoreConfigService } from '../../config/core-config.service';
import { ContextProvider } from 'libs/utils/providers/context.provider';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: CoreConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        const refreshToken = req.body.refreshToken;
        return refreshToken;
      },
      secretOrKey: configService.authentication.secret,
    });
  }

  async validate(args: { userId: number; role: Role; type: TokenType }) {
   
    if (args.type !== TokenType.REFRESH_TOKEN) {
      throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prismaService.user.findFirst({
      where: { id: args.userId, isBan: false },
    });

    if (!user) {
      throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
    }
    
    ContextProvider.setAuthUser(user);
    return user;
  }
}
