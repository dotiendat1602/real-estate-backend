import { IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllPropertyCategoryDto extends DefaultPaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}