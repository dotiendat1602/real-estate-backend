import { ApiProperty } from "@nestjs/swagger";
import { UtilityCategory } from "@prisma/client";
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from "class-validator";

export class CreatePropertyUtilityDto {
  @ApiProperty({ description: 'Utility name', example: 'Trường tiểu học' })
  @IsNotEmpty()
  @IsString()
  utility_name: string;

  @ApiProperty({ description: 'Utility category', example: 'EDUCATION' })
  @IsNotEmpty()
  @IsEnum(UtilityCategory)
  utility_category: UtilityCategory;

  @ApiProperty({ description: 'Utility latitude', example: 10.123456 })
  @IsOptional()
  @IsNumber()
  @Min(-90) @Max(90)
  lat: number;

  @ApiProperty({ description: 'Utility longitude', example: 10.123456 })
  @IsOptional()
  @IsNumber()
  @Min(-180) @Max(180)
  lon: number;

  @ApiProperty({ description: 'Utility location', example: 'Hà Nội, Việt Nam' })
  @IsOptional()
  @IsString()
  location: string;

  @ApiProperty({ description: 'Utility province', example: 'Hà Nội' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  province_id: number;

  @ApiProperty({ description: 'Utility district', example: 'Hà Đông' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  district_id: number;

  @ApiProperty({ description: 'Utility ward', example: 'Phú La' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  ward_id: number;
}