import { Injectable } from '@nestjs/common';
import { WebAppUser } from './user.type';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { User } from '@prisma/client';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { pick } from 'lodash';
import TonWeb from 'tonweb';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async getUserInfo() {
    const user = ContextProvider.getAuthUser<User>();
    // return user;
    return {
      ...user,
    };
  }

  async updateUserProfile(dto: UpdateUserProfileDto) {
    const user = ContextProvider.getAuthUser<User>();

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        ...pick(dto, ['cityId']),
      },
    });
  }
}
