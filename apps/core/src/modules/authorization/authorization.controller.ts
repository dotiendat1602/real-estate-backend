import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { AuthorizationService } from "./services/authorization.service";
import { Body, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { GetAllRolesDto } from "./dto/get-all-roles.dto";
import { GetAllPermissionsDto } from "./dto/get-all-permissions.dto";
import { Auth } from "libs/utils";
import { SystemPermissionType } from "@prisma/client";
import { AssignPermissionToRoleDto } from "./dto/assign-permission-to-role.dto";
import { GetAllRolesPermissionsDto } from "./dto/get-all-role-permission.dto";

@CoreControllers({
  path: "authorization",
  version: "1",
  tag: "Authorization",
})
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) { }

  // Endpoint: GET /api/core/authorization/roles
  @Auth([SystemPermissionType.MANAGE_USERS])
  @Get("roles")
  async getAllRoles(
    @Query() query: GetAllRolesDto,
  ) {
    return this.authorizationService.getAllRoles(query);
  }

  // Endpoint: GET /api/core/authorization/permissions
  @Auth([SystemPermissionType.MANAGE_USERS])
  @Get("permissions")
  async getAllPermissions(
    @Query() query: GetAllPermissionsDto,
  ) {
    return this.authorizationService.getAllPermissions(query);
  }

  // Endpoint: GET /api/core/authorization/roles/permissions
  @Auth([SystemPermissionType.MANAGE_USERS])
  @Get("roles/permissions")
  async getRolePermission(
    @Query() query: GetAllRolesPermissionsDto,
  ) {
    return this.authorizationService.getAllRolesPermissions(query);
  }

  // Endpoint: POST /api/core/authorization/assign-permissions-to-role/:roleId
  @Auth([SystemPermissionType.MANAGE_USERS])
  @Post("assign-permissions-to-role/:roleId")
  async assignPermissionsToRole(
    @Param("roleId", ParseIntPipe) roleId: number,
    @Body() dto: AssignPermissionToRoleDto,
  ) {
    return this.authorizationService.assignPermissionsToRole(roleId, dto);
  }
}