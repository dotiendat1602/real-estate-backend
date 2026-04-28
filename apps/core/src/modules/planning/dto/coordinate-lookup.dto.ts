import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString } from "class-validator";

export class CoordinateLookupDto {
  @ApiProperty({
    description: "Latitude of the property/location",
    example: 20.9386337,
  })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({
    description: "Longitude of the property/location",
    example: 105.720122,
  })
  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({
    description: "Planning period label",
    example: "KHSDĐ cấp huyện năm 2025",
  })
  @IsOptional()
  @IsString()
  kyQuyHoach?: string;

  @ApiPropertyOptional({
    description: "Force bypassing cache and re-query source",
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forceRefresh?: boolean;
}
