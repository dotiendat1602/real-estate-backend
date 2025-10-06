import { Status } from "@prisma/client";
import { IsEnum, IsOptional, IsPositive, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllPropertyDto extends DefaultPaginationDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsEnum(Status)
  status?: Status

  @IsOptional()
  @IsPositive()
  priceFrom?: number

  @IsOptional()
  @IsPositive()
  priceTo?: number

  @IsOptional()
  @IsString()
  province?: string

  @IsOptional()
  @IsString()
  district?: string

  @IsOptional()
  @IsString()
  ward?: string
}