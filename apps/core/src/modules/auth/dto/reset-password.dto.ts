import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomValidateIsPassword } from 'libs/utils/pipes/validation.pipe';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token to reset password',
    example: 'eyadmasdasdadadl',
  })
  @IsNotEmpty()
  @IsString()
  resetToken: string;

  @ApiProperty({
    description:
      'User password, should be at least 6 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    example: 'Password123@',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  @Validate(CustomValidateIsPassword)
  newPassword: string;
}
