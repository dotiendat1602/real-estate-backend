import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  IsNumber,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FurnitureStatus, LegalStatus, Status } from '@prisma/client';

export class CreatePropertyDto {
  @ApiProperty({ description: 'Name / Title of property', example: 'Căn hộ Vinhomes Grand Park' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Danh sách ảnh (tạo kèm)',
    example: [{ imageUrl: 'https://.../1.jpg', isPrimary: true }, { imageUrl: 'https://.../2.jpg' }],
  })
  @IsOptional()
  images?: Array<{ imageUrl: string; isPrimary?: boolean }>;

  @ApiPropertyOptional({ description: 'Description of property', example: '2PN, 2WC, full nội thất...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Price (VND). Max 2 chữ số thập phân', example: 2150000000.00 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number; // Prisma Decimal(18,2)

  @ApiPropertyOptional({ description: 'Area (m²). Max 2 chữ số thập phân', example: 68.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area?: number; // Decimal(10,2)

  @ApiPropertyOptional({ description: 'Bedrooms', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedroomNumber?: number;

  @ApiPropertyOptional({ description: 'Toilets', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  toiletNumber?: number;

  @ApiPropertyOptional({ description: 'Floors', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floorNumber?: number;

  @ApiPropertyOptional({ description: 'Has parking?', example: true })
  @IsOptional()
  @IsBoolean()
  parking?: boolean;

  @ApiPropertyOptional({ description: 'Orientation', example: 'Đông Nam' })
  @IsOptional()
  @IsString()
  orientation?: string;

  @ApiPropertyOptional({ description: 'Frontage (m), max 2 decimals', example: 5.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  frontage?: number; // Decimal(6,2)

  @ApiPropertyOptional({ description: 'Road width (m), max 2 decimals', example: 8.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  roadWidth?: number; // Decimal(6,2)

  @ApiPropertyOptional({ enum: FurnitureStatus, example: FurnitureStatus.FULLY_FURNISHED })
  @IsOptional()
  @IsEnum(FurnitureStatus)
  furnitureStatus?: FurnitureStatus;

  @ApiPropertyOptional({ enum: LegalStatus, example: LegalStatus.RED_BOOK })
  @IsOptional()
  @IsEnum(LegalStatus)
  legalStatus?: LegalStatus;

  @ApiPropertyOptional({ description: 'Year built', example: 2020 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear() + 1)
  yearBuilt?: number;

  @ApiPropertyOptional({ description: 'Latitude (±90), 6 decimals', example: 10.841234 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number; // Decimal(9,6)

  @ApiPropertyOptional({ description: 'Longitude (±180), 6 decimals', example: 106.814567 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon?: number; // Decimal(9,6)

  @ApiPropertyOptional({ description: 'Readable location string', example: 'P.Long Bình, TP.Thủ Đức, TP.HCM' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'Property category id (FK)', example: 3 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId: number;

  @ApiPropertyOptional({ description: 'Ward id (FK)', example: 1001 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wardId?: number;

  @ApiPropertyOptional({ description: 'District id (FK)', example: 769 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  districtId?: number;

  @ApiPropertyOptional({ description: 'Province id (FK)', example: 79 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  provinceId?: number;

  @ApiPropertyOptional({ enum: Status, example: Status.ACTIVE })
  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @ApiPropertyOptional({
    description: 'Danh sách amenity_id (gắn kèm)',
    example: [1, 5, 9],
  })
  @IsOptional()
  amenityIds?: number[];

  @ApiPropertyOptional({
    description: 'Utilities gắn kèm (utility_id + metadata N-N)',
    example: [{ utility_id: 45, distance_m: 350.25, is_primary: true }],
  })
  @IsOptional()
  utilities?: Array<{ id: number; distanceM?: number; travelTimeS?: number; isPrimary?: boolean; note?: string }>;
}
