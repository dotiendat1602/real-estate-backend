import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllPermissionsDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: "Search by permission name",
    example: "MANAGE_USERS",
  })
  @IsOptional()
  @IsString()
  search?: string;
}