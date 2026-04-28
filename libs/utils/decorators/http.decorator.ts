import {
  applyDecorators,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  type PipeTransform,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { type Type } from '@nestjs/common/interfaces';
import {
  ApiBearerAuth,
  ApiBody,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthUserInterceptor } from '../interceptors';
import { AuthGuard } from '../guards';
import { SystemPermissionType } from '@prisma/client';
import { PermissionsGuard } from '../guards/permission.guard';
import { Permissions } from './permission.decorator';

export function Auth(
  permissions: SystemPermissionType[] = [],
  options?: Partial<{ public: boolean }>,
): MethodDecorator {
  const isPublicRoute = options?.public;

  return applyDecorators(
    Permissions(permissions),
    UseGuards(AuthGuard({ public: isPublicRoute }), PermissionsGuard),
    ApiBearerAuth(),
    UseInterceptors(AuthUserInterceptor),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

export function AuthRefreshToken(): MethodDecorator {
  return applyDecorators(
    UseGuards(AuthGuard({ refreshToken: true })),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
        required: ['refreshToken'],
      },
    }),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

export function UUIDParam(
  property: string,
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ParameterDecorator {
  return Param(property, new ParseUUIDPipe({ version: '4' }), ...pipes);
}

export function IntParam(
  property: string,
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ParameterDecorator {
  return Param(property, new ParseIntPipe(), ...pipes);
}

export function ObjectIdParam(
  property: string,
  ...pipes: Array<Type<PipeTransform> | PipeTransform>
): ParameterDecorator {
  return Param(property, new ParseUUIDPipe({ version: '4' }), ...pipes);
}
