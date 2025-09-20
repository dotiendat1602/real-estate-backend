import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Patch
} from '@nestjs/common';
import { Auth } from 'libs/utils';
import { CoreControllers } from 'libs/utils/decorators/controller-customer.decorator';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserService } from './user.service';

@CoreControllers({
  path: 'users',
  version: '1',
  tag: 'User',
})
export class UserController {
  constructor(private readonly userService: UserService) {}

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
  @Get('rank')
  @HttpCode(HttpStatus.OK)
  async getMyRank() {
    return await this.userService.getUserInfo();
  }
}
