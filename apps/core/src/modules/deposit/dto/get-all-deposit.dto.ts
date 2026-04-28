import { ApiPropertyOptional } from "@nestjs/swagger";
import { DepositStatus } from "@prisma/client";
import { IsDate, IsEnum, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllDepositDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: "Filter deposit by Post name, seller, buyer",
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: "Filter deposit by time expire from",
  })
  @IsOptional()
  @IsDate()
  date_from?: Date

  @ApiPropertyOptional({
    description: "Filter deposit by time expire to",
  })
  @IsOptional()
  @IsDate()
  date_to?: Date

  @ApiPropertyOptional({
    description: "Filter deposit by status",
  })
  @IsOptional()
  @IsEnum(DepositStatus)
  status?: DepositStatus
}
