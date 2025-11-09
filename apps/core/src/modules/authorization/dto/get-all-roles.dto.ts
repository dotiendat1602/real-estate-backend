import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllRolesDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: "Search by role name",
    example: "admin",
  })
  @IsOptional()
  @IsString()
  search?: string;
}