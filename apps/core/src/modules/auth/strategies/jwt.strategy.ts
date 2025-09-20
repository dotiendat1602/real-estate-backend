import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ApiException } from 'libs/utils/exception';
import { Role } from '@prisma/client';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { TokenType } from 'libs/utils/enum';
import { CoreConfigService } from '../../config/core-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: CoreConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.authentication.secret,
    });
  }

  async validate(args: { userId: number; role: Role; type: TokenType }) {
    if (args.type !== TokenType.ACCESS_TOKEN) {
      throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.prismaService.user.findFirst({
      where: { id: args.userId, isBan: false },
    });

    if (!user) {
      throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
    }

    return user;
  }
}
