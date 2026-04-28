import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";
import { NewsStatus } from "./create-article.dto";

export class GetAllArticleDto extends DefaultPaginationDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  topicId?: number;

  @IsOptional()
  @IsEnum(NewsStatus)
  status?: NewsStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
