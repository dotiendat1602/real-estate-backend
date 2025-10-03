import { IsInt, Min, IsOptional, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class DefaultPaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsInt()
  @Min(1, { message: 'Page index must be greater than or equal to 1' })
  pageIndex?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsInt()
  @Min(1, { message: 'Page size (limit) must be greater than or equal to 1' })
  pageSize?: number;

  @IsOptional()
  @IsString()
  sortKey?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be "asc" or "desc"' })
  sortOrder?: 'asc' | 'desc';
}