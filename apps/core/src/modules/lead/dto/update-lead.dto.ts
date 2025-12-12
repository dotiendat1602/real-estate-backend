import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateLeadDto {
  @ApiPropertyOptional({ description: 'Status of the lead' })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ description: 'Note about the lead' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignLeadDto {
  @ApiProperty({ description: 'ID of the agent to assign the lead to' })
  @Type(() => Number)
  @IsInt()
  agentId: number;
}
