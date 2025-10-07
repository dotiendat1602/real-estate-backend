import { ApiPropertyOptional } from "@nestjs/swagger";
import { PostStatus, PostType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

enum PostMode {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class GetAllPostsDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: "Filter by Post Title",
    example: "Căn hộ"
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: "Filter by Post Type",
    example: "SALE"
  })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType

  @ApiPropertyOptional({
    description: "Filter by Post Status",
    example: "PENDING"
  })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus

  @ApiPropertyOptional({
    description: "Filter by Post Mode",
    example: "PENDING"
  })
  @IsOptional()
  @IsEnum(PostMode)
  mode?: PostMode
}