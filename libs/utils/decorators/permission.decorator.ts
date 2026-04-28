import { SetMetadata } from '@nestjs/common';
import { SystemPermissionType } from '@prisma/client';

export const Permissions = (permissions: SystemPermissionType[]) => SetMetadata('permissions', permissions);
