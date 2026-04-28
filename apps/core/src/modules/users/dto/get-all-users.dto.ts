import { RoleType, Status } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class getAllUsersDto extends DefaultPaginationDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(Status)
  status?: Status

  @IsOptional()
  @IsEnum(RoleType)
  role?: RoleType
}