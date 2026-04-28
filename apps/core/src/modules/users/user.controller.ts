import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  Query
} from '@nestjs/common';
import { Auth } from 'libs/utils';
import { CoreControllers } from 'libs/utils/decorators/controller-customer.decorator';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserService } from './user.service';
import { getAllUsersDto } from './dto/get-all-users.dto';
import { CreateUsersDto } from './dto/create-user.dto';
import { EditUsersDto } from './dto/edit-user.dto';
import { ChangePasswordDto } from './change-password.dto';
import { SystemPermissionType } from '@prisma/client';
import { GetFeaturedAgentsDto } from './dto/get-featured-agents.dto';

@CoreControllers({
  path: 'users',
  version: '1',
  tag: 'User',
})
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Auth()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe() {
    return await this.userService.getUserInfo();
  }

  @Auth()
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Body() dto: UpdateUserProfileDto) {
    return await this.userService.updateUserProfile(dto);
  }

  @Auth()
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto) {
    return await this.userService.changePassword(dto);
  }

  @Auth([SystemPermissionType.MANAGE_USERS])
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllUsers(
    @Query() query: getAllUsersDto
  ) {
    return await this.userService.getAllUsers(query);
  }

  @Auth([SystemPermissionType.MANAGE_USERS])
  @Post()
  @HttpCode(HttpStatus.OK)
  async createUser(
    @Body() body: CreateUsersDto
  ) {
    return await this.userService.createUser(body);
  }

  @Auth([SystemPermissionType.MANAGE_USERS])
  @Patch("/:userId")
  @HttpCode(HttpStatus.OK)
  async editUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: EditUsersDto,
  ) {
    return await this.userService.editUser(userId, body);
  }

  @Auth([SystemPermissionType.MANAGE_USERS])
  @Delete("/:userId")
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.userService.deleteUser(userId);
  }

  @Get("agents/featured")
  @HttpCode(HttpStatus.OK)
  async getFeaturedAgents(
    @Query() query: GetFeaturedAgentsDto,
  ) {
    return await this.userService.getFeaturedAgents(query);
  }

  @Get("agents/:agentId")
  @HttpCode(HttpStatus.OK)
  async getAgentDetail(
    @Param('agentId', ParseIntPipe) agentId: number,
  ) {
    return await this.userService.getAgentDetail(agentId);
  }
}
