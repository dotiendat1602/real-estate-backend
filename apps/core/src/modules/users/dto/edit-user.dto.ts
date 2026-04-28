import { ApiPropertyOptional } from "@nestjs/swagger";
import { RoleType, Status } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class EditUsersDto {
  @ApiPropertyOptional({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({
    description: 'User name',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({
    description: "User role, must be 'ADMIN' or 'USER'",
    example: 'ADMIN',
  })
  @IsOptional()
  @IsEnum(RoleType)
  role?: RoleType

  @ApiPropertyOptional({
    description: "User status, must be 'ACTIVE' or 'INACTIVE'",
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status
}