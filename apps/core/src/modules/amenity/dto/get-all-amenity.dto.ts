import { AmenityCategory } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllAmenityDto extends DefaultPaginationDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(AmenityCategory)
  category?: AmenityCategory
}