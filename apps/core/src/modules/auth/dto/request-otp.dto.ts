import {
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({
    description: 'User email address, should be a valid email format',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
