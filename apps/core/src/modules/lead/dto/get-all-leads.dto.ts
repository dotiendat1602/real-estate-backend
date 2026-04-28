import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus } from '@prisma/client';
import { DefaultPaginationDto } from 'libs/utils/pagination/pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetAllLeadsDto extends DefaultPaginationDto {
  @ApiPropertyOptional({ description: 'Search by name/email/phone/message' })
  @IsOptional()
  @IsString()
  search?: string; // name/email/phone/message

  @ApiPropertyOptional({ description: 'Filter by status', enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Filter by postId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  postId?: number;

  @ApiPropertyOptional({ description: 'Filter by buyerId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  buyerId?: number;

  @ApiPropertyOptional({ description: 'Filter by agentId' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  agentId?: number;
}
