import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty({ description: 'ID of the post the lead is interested in' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  post_id: number;

  @ApiProperty({ description: 'ID of the buyer making the inquiry' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  buyerId: number;

  @ApiPropertyOptional({ description: 'Name of the lead' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email of the lead' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number of the lead' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Additional message from the lead' })
  @IsOptional()
  @IsString()
  message?: string;
}
