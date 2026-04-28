import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User email address, should be a valid email format',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'OTP to reset password',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  otp: string;
}