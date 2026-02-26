import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllReportDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo ID bài đăng',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  postId?: number;
}
