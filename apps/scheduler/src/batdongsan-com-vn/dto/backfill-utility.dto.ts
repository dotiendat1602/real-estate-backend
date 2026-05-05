import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional } from "class-validator";

export class BackfillNearbyUtilitiesDto {
  @ApiPropertyOptional({
    description: 'Maximum number of properties to backfill. If not provided, backfill will continue until all properties are processed.',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
