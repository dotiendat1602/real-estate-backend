import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength, Validate } from "class-validator";
import { CustomValidateIsPassword } from "libs/utils/pipes/validation.pipe";

export class ChangePasswordDto {
  @ApiProperty({
    description:
      'User current password',
    example: 'Password123@',
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description:
      'User new password, should be at least 6 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    example: 'Password123@',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  @Validate(CustomValidateIsPassword)
  newPassword: string;
}