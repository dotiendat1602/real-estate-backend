import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllRolesDto } from "../dto/get-all-roles.dto";
import { GetAllPermissionsDto } from "../dto/get-all-permissions.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { Prisma } from "@prisma/client";
import { AssignPermissionToRoleDto } from "../dto/assign-permission-to-role.dto";
import { GetAllRolesPermissionsDto } from "../dto/get-all-role-permission.dto";
import { ApiException } from "libs/utils/exception";

@Injectable()
export class AuthorizationService {
  constructor(private readonly prismaService: PrismaService) { }

  async getAllRoles(query: GetAllRolesDto) {
    const paging = assignPaging(query);

    const orderObject = {
      [paging.sortKey || 'name']: paging.sortOrder || 'asc',
    };

    const where: Prisma.RoleWhereInput = {};

    if (paging.search) {
      const keyword = paging.search.trim();
      where.OR = [
        { name: { equals: keyword.toUpperCase() as any } },
        { description: { contains: keyword, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [roles, total] = await Promise.all([
      this.prismaService.role.findMany({
        where,
        orderBy: orderObject,
        skip: paging.skip,
        take: paging.take,
      }),
      this.prismaService.role.count({ where }),
    ]);

    return returnPaging(roles, total, paging);
  }

  async getAllPermissions(query: GetAllPermissionsDto) {
    const paging = assignPaging(query);

    const orderObject = {
      [paging.sortKey || 'name']: paging.sortOrder || 'asc',
    };

    const where: Prisma.PermissionWhereInput = {};

    if (paging.search) {
      const keyword = paging.search.trim();
      where.name = { equals: keyword.toUpperCase() as any };
    }

    const [permissions, total] = await Promise.all([
      this.prismaService.permission.findMany({
        where,
        orderBy: orderObject,
        skip: paging.skip,
        take: paging.take,
        include: {
          _count: {
            select: {
              roles: true,
            }
          }
        }
      }),
      this.prismaService.permission.count({ where }),
    ]);

    const data = permissions.map(permission => ({
      permissionId: permission.id,
      name: permission.name,
      assignedRolesCount: permission._count.roles,
    }));

    return returnPaging(data, total, paging);
  }

  async getAllRolesPermissions(query: GetAllRolesPermissionsDto) {
    const paging = assignPaging(query);

    const where: Prisma.RolesPermissionsWhereInput = {};

    if (paging.search) {
      const keyword = paging.search.trim();
      where.OR = [
        {
          role: {
            name: {
              equals: keyword.toUpperCase() as any,
            }
          }
        },
        {
          permission: {
            name: {
              equals: keyword.toUpperCase() as any,
            }
          }
        },
      ];
    }

    const [rolesPermissions, total] = await Promise.all([
      this.prismaService.rolesPermissions.findMany({
        where,
        skip: paging.skip,
        take: paging.take,
        select: {
          role: {
            select: {
              id: true,
              name: true,
            }
          },
          permission: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      this.prismaService.rolesPermissions.count({ where }),
    ]);

    return returnPaging(rolesPermissions, total, paging);
  }

  async assignPermissionsToRole(roleId: number, body: AssignPermissionToRoleDto) {
    const permissionIds = body.permissionIds;

    const existingRole = await this.prismaService.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!existingRole) {
      throw new ApiException(
        `Role with ID ${roleId} does not exist.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check exist permission IDs
    const existingPermissions = await this.prismaService.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
      select: { id: true },
    });
    const existingPermissionIds = existingPermissions.map(p => p.id);
    const invalidPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id));

    if (invalidPermissionIds.length > 0) {
      throw new ApiException(
        `Invalid permission IDs: ${invalidPermissionIds.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prismaService.rolesPermissions.deleteMany({
      where: {
        roleId: roleId,
      },
    });

    const rolesPermissionsData = permissionIds.map(permissionId => ({
      roleId: roleId,
      permissionId: permissionId,
    }));

    const result = await this.prismaService.rolesPermissions.createMany({
      data: rolesPermissionsData,
      skipDuplicates: true,
    });

    return {
      result,
      message: `Assigned ${result.count} permissions to role ID ${roleId}.`,
    }
  }
}