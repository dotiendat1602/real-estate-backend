import { ApiPropertyOptional } from "@nestjs/swagger";
import { UtilityCategory } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllPropertyUtilitiesDto extends DefaultPaginationDto {
  @ApiPropertyOptional({ description: 'Filter by utility name', example: 'Trường tiểu học' })
  @IsOptional()
  @IsString()
  utilityName?: string;

  @ApiPropertyOptional({ description: 'Filter by utility category', example: 'EDUCATION' })
  @IsOptional()
  @IsEnum(UtilityCategory)
  utilityCategory?: UtilityCategory;

  @ApiPropertyOptional({ example: 79 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  province_id?: number;

  @ApiPropertyOptional({ example: 769 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  district_id?: number;

  @ApiPropertyOptional({ example: 1001 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  ward_id?: number;
}