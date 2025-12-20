import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemPermissionType } from '@prisma/client';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { isEmpty } from 'lodash';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.get<SystemPermissionType[]>('permissions', context.getHandler());

    if (isEmpty(permissions)) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.roleId) {
      return false;
    }

    const role = await this.prismaService.role.findFirst({
      where: {
        id: user.roleId,
      },
      include: {
        permissions: {
          select: {
            permission: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return false;
    }

    // Extract permission names from the role's permissions
    const userPermissions = role.permissions.map(rp => rp.permission.name);

    // Check if user has at least one of the required permissions
    return permissions.some((requiredPermission) =>
      userPermissions.includes(requiredPermission)
    );
  }
}
