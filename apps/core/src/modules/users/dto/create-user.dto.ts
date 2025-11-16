import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RoleType } from "@prisma/client";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateUsersDto {
  @ApiProperty({
    description: 'User name',
    example: 'user',
  })
  @IsNotEmpty()
  @IsString()
  name: string

  @ApiProperty({
    description: 'User email address, should be a valid email format',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '0123456789',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string

  @ApiProperty({
    description: "User role, must be 'ADMIN' or 'USER'",
    example: 'ADMIN',
  })
  @IsNotEmpty()
  @IsEnum(RoleType)
  role: RoleType
}