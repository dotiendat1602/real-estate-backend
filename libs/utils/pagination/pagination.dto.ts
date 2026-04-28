import { IsInt, Min, IsOptional, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DefaultPaginationDto {
  @ApiPropertyOptional({
    description: 'Chỉ số trang, bắt đầu từ 1',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsInt()
  @Min(1, { message: 'Page index must be greater than or equal to 1' })
  pageIndex?: number;

  @ApiPropertyOptional({
    description: 'Kích thước trang (số mục trên mỗi trang)',
    example: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10), { toClassOnly: true })
  @IsInt()
  @Min(1, { message: 'Page size (limit) must be greater than or equal to 1' })
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Khóa sắp xếp',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortKey?: string;

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp: "asc" hoặc "desc"',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort order must be "asc" or "desc"' })
  sortOrder?: 'asc' | 'desc';
}
