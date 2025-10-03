import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemPermissionType } from '@prisma/client';
import { isEmpty } from 'lodash';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.get<SystemPermissionType[]>('permissions', context.getHandler());

    if (isEmpty(permissions)) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return permissions.some((p) => user.permissions.includes(p));
  }
}
