import { ApiPropertyOptional } from "@nestjs/swagger";
import { Status } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllPropertyDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: 'Search by property name',
    example: 'Beautiful Apartment',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Search by property status',
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(Status)
  status?: Status

  @ApiPropertyOptional({
    description: 'Search by minimum price',
    example: 1000000,
  })
  @IsOptional()
  @IsPositive()
  priceFrom?: number

  @ApiPropertyOptional({
    description: 'Search by maximum price',
    example: 5000000,
  })
  @IsOptional()
  @IsPositive()
  priceTo?: number

  @ApiPropertyOptional({
    description: 'Search by province',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  province_id?: number

  @ApiPropertyOptional({
    description: 'Search by district',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  district_id?: number

  @ApiPropertyOptional({
    description: 'Search by ward',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  ward_id?: number
}