import { ApiPropertyOptional } from "@nestjs/swagger";
import { PostStatus, PostType } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

enum PostMode {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
};

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number.parseInt(String(value), 10);
};

const toIntArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const values = raw
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  return values.length ? values : undefined;
};

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

  @ApiPropertyOptional({ description: "Minimum property price", example: 1000000000 })
  @IsOptional()
  @Transform(toOptionalNumber, { toClassOnly: true })
  @IsNumber()
  @Min(0)
  priceFrom?: number

  @ApiPropertyOptional({ description: "Maximum property price", example: 5000000000 })
  @IsOptional()
  @Transform(toOptionalNumber, { toClassOnly: true })
  @IsNumber()
  @Min(0)
  priceTo?: number

  @ApiPropertyOptional({ description: "Minimum property area", example: 50 })
  @IsOptional()
  @Transform(toOptionalNumber, { toClassOnly: true })
  @IsNumber()
  @Min(0)
  areaFrom?: number

  @ApiPropertyOptional({ description: "Maximum property area", example: 120 })
  @IsOptional()
  @Transform(toOptionalNumber, { toClassOnly: true })
  @IsNumber()
  @Min(0)
  areaTo?: number

  @ApiPropertyOptional({ description: "Minimum bedrooms", example: 2 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(0)
  bedroomNumber?: number

  @ApiPropertyOptional({ description: "Minimum bathrooms", example: 2 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(0)
  toiletNumber?: number

  @ApiPropertyOptional({ description: "Property category id", example: 1 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(1)
  categoryId?: number

  @ApiPropertyOptional({ description: "Province id", example: 1 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(1)
  provinceId?: number

  @ApiPropertyOptional({ description: "District id", example: 1 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(1)
  districtId?: number

  @ApiPropertyOptional({ description: "Ward id", example: 1 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(1)
  wardId?: number

  @ApiPropertyOptional({ description: "Created by agent id", example: 1 })
  @IsOptional()
  @Transform(toOptionalInt, { toClassOnly: true })
  @IsInt()
  @Min(1)
  agentId?: number

  @ApiPropertyOptional({ description: "Amenity ids, comma-separated or repeated", example: "1,2,3" })
  @IsOptional()
  @Transform(toIntArray, { toClassOnly: true })
  @IsArray()
  @IsInt({ each: true })
  amenityIds?: number[]

  @ApiPropertyOptional({ description: "Nearby utility ids, comma-separated or repeated", example: "1,2,3" })
  @IsOptional()
  @Transform(toIntArray, { toClassOnly: true })
  @IsArray()
  @IsInt({ each: true })
  utilityIds?: number[]
}
