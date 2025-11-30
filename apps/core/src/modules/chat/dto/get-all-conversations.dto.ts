import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllConversationsDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo từ khóa',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Id của người dùng (buyer/agent)',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  buyerId?: number;

  @ApiPropertyOptional({
    description: 'Id của bài viết',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  postId?: number;

  @ApiPropertyOptional({
    description: 'Id của agent',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  agentId?: number;
}
