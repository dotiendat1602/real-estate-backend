import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { TokenType } from 'libs/utils/enum';
import { ApiException } from 'libs/utils/exception';
import { CoreConfigService } from '../../config/core-config.service';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: CoreConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  private async createAccessToken(data: { role: Role; userId: bigint }) {
    return await this.jwtService.signAsync(
      {
        userId: data.userId,
        type: TokenType.ACCESS_TOKEN,
        role: data.role,
      },
      { expiresIn: this.configService.authentication.accessExpireTime },
    );
  }

  private async createRefreshToken(data: { role: Role; userId: bigint }) {
    return await this.jwtService.signAsync(
      {
        userId: data.userId,
        type: TokenType.REFRESH_TOKEN,
        role: data.role,
      },
      { expiresIn: this.configService.authentication.refreshExpireTime },
    );
  }

  async signToken(user: User, isAccessToken = false) {
    const accessToken = await this.createAccessToken({
      userId: user.id,
      role: user.role,
    });

    const refreshToken = await this.createRefreshToken({
      userId: user.id,
      role: user.role,
    });

    if (isAccessToken) {
      return { accessToken };
    }
    return { accessToken, refreshToken };
  }

  async verifyAccessToken(authorization: string) {
    const accessToken = authorization.split('Bearer ')?.at(1);

    if (!accessToken) {
      throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
    }

    try {
      const decoded = await this.jwtService.verify(accessToken);

      if (decoded.type !== TokenType.ACCESS_TOKEN) {
        throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
      }

      const user = await this.prismaService.user.findFirst({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
      }

      return user;
    } catch (error) {
      throw new ApiException('Unauthorize', HttpStatus.UNAUTHORIZED);
    }
  }
}
