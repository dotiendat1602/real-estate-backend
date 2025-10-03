import { ApiProperty } from "@nestjs/swagger";
import { RoleType, Status } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class EditUsersDto {
  @ApiProperty({
    description: 'User name',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  name?: string

  @ApiProperty({
    description: "User role, must be 'ADMIN' or 'USER'",
    example: 'ADMIN',
  })
  @IsOptional()
  @IsEnum(RoleType)
  role?: RoleType

  @ApiProperty({
    description: "User status, must be 'ACTIVE' or 'INACTIVE'",
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status
}