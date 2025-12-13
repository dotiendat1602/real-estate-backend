import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { Prisma, RoleType, User } from '@prisma/client';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { getAllUsersDto } from './dto/get-all-users.dto';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { CreateUsersDto } from './dto/create-user.dto';
import { EditUsersDto } from './dto/edit-user.dto';
import { ApiException } from 'libs/utils/exception';
import { generateHash, validateHash } from 'libs/utils/util';
import { ErrorCode, ItemMessage } from 'libs/utils/enum';
import { ChangePasswordDto } from './change-password.dto';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) { }

  private DEFAULT_PASSWORD = "Password123@";

  private async checkExistRole(role: RoleType) {
    const existRole = await this.prismaService.role.findFirst({
      where: {
        name: role,
      },
    })
    if (!existRole) {
      throw new ApiException(
        `Role ${role} is not existed or might be deleted in system`,
        HttpStatus.NOT_FOUND,
      )
    }
    return existRole;
  }

  async getUserInfo() {
    const user = ContextProvider.getAuthUser<User>();
    // return user;
    const userInfo = await this.prismaService.user.findFirst({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        role: {
          select: {
            name: true,
          }
        }
      }
    });
    if (!userInfo) {
      throw new ApiException(
        `User not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      phone: userInfo.phone,
      status: userInfo.status,
      role: userInfo.role,
    };
  }

  async updateUserProfile(dto: UpdateUserProfileDto) {
    const user = ContextProvider.getAuthUser<User>();

    return await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        role: {
          select: {
            name: true,
          }
        }
      }
    });
  }

  async changePassword(dto: ChangePasswordDto) {
    const user = ContextProvider.getAuthUser<User>();

    if (await validateHash(dto.currentPassword, user.password)) {
      return await this.prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: generateHash(dto.newPassword),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          status: true,
          role: {
            select: {
              name: true,
            }
          }
        }
      });
    }
    throw new ApiException(
      `Current password is wrong`,
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_INPUT,
    )
  }

  async getAllUsers(query: getAllUsersDto) {
    const pagingParams = assignPaging(query);

    const orderObject = {
      [pagingParams.sortKey || 'name']: pagingParams.sortOrder || 'asc',
    };

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        {
          name: {
            contains: q,
            mode: "insensitive"
          }
        },
        {
          email: {
            contains: q,
            mode: "insensitive"
          }
        },
      ]
    }

    if (pagingParams.status) {
      where.status = pagingParams.status;
    }

    if (pagingParams.role) {
      where.role = {
        name: pagingParams.role as RoleType,
      }
    }

    const users = await this.prismaService.user.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        role: {
          select: {
            name: true,
          }
        }
      }
    })

    const totalItems = await this.prismaService.user.count({
      where,
    });

    return returnPaging(users, totalItems, pagingParams);
  }

  async createUser(body: CreateUsersDto) {
    const role = await this.checkExistRole(body.role);

    const existUser = await this.prismaService.user.findFirst({
      where: {
        email: body.email,
      },
    })

    try {
      if (!existUser) {
        const newUser = await this.prismaService.user.create({
          data: {
            name: body.name,
            email: body.email,
            phone: body.phoneNumber || null,
            password: generateHash(this.DEFAULT_PASSWORD),
            roleId: role.id,
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: {
              select: {
                name: true,
              }
            }
          }
        })
        return newUser;

      } else if (existUser.deletedAt === null) {
        throw new ApiException(
          `This user with email ${body.email} is already existed in system`,
          HttpStatus.CONFLICT,
        )

      } else {
        const restoreUser = await this.prismaService.user.update({
          where: {
            id: existUser.id,
          },
          data: {
            name: body.name,
            phone: body.phoneNumber || null,
            password: generateHash(this.DEFAULT_PASSWORD),
            roleId: role.id,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: {
              select: {
                name: true,
              }
            }
          }
        })
        return restoreUser;
      }
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      )
    }
  }

  async editUser(userId: number, body: EditUsersDto) {
    const existUser = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      }
    })
    if (!existUser) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: User not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }

    let existRole;
    if (body.role) {
      existRole = await this.checkExistRole(body.role);
    }

    if (body.email && body.email !== existUser.email) {
      const emailUsed = await this.prismaService.user.findFirst({
        where: {
          email: body.email,
          deletedAt: null,
          NOT: {
            id: userId,
          }
        }
      })

      if (emailUsed) {
        throw new ApiException(
          `This email ${body.email} is already used by another user`,
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_INPUT,
        )
      }
    }

    try {
      const newUser = await this.prismaService.user.update({
        where: {
          id: userId,
        },
        data: {
          email: body.email ?? existUser.email,
          phone: body.phone ?? existUser.phone,
          name: body.name ?? existUser.name,
          roleId: existRole ? existRole.id : existUser.roleId,
          status: body.status ?? existUser.status,
        }
      })
      return newUser;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      )
    }
  }

  async deleteUser(userId: number) {
    const existUser = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      }
    })
    if (!existUser) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: User not found or has been deleted`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }

    try {
      return await this.prismaService.user.update({
        where: {
          id: userId,
        },
        data: {
          deletedAt: new Date()
        }
      })
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      )
    }
  }
}