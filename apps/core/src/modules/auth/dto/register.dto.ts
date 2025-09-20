import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { CustomValidateIsPassword } from 'libs/utils/pipes/validation.pipe';
import { ApiProperty } from '@nestjs/swagger';

export class CoreUserRegisterDto {
  @ApiProperty({
    description: 'User email address, should be a valid email format',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'User password, should be at least 6 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    example: 'Password123',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  @Validate(CustomValidateIsPassword)
  password: string;

  @ApiProperty({
    description: 'User name, should not exceed 50 characters',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;
}
