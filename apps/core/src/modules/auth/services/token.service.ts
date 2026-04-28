import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
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
  ) { }

  private async createAccessToken(data: { user_id: number; email: string; role_id: number }) {
    return await this.jwtService.signAsync(
      {
        user_id: data.user_id,
        email: data.email,
        type: TokenType.ACCESS_TOKEN,
        systemRole: data.role_id,
      },
      { expiresIn: this.configService.authentication.accessExpireTime },
    );
  }

  private async createRefreshToken(data: { user_id: number; email: string; role_id: number }) {
    return await this.jwtService.signAsync(
      {
        user_id: data.user_id,
        email: data.email,
        type: TokenType.ACCESS_TOKEN,
        systemRole: data.role_id,
      },
      { expiresIn: this.configService.authentication.refreshExpireTime },
    );
  }

  async signToken(user: User, isAccessToken = false) {
    const accessToken = await this.createAccessToken({
      user_id: user.id,
      email: user.email,
      role_id: user.roleId,
    });

    const refreshToken = await this.createRefreshToken({
      user_id: user.id,
      email: user.email,
      role_id: user.roleId,
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
