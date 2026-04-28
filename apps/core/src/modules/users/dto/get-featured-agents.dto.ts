import { IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetFeaturedAgentsDto extends DefaultPaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
