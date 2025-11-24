import { ApiPropertyOptional } from "@nestjs/swagger";
import { AppointmentStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllAppointmentsDto extends DefaultPaginationDto {
  @ApiPropertyOptional({
    description: "Filter appointment by post title, buyer name, seller name, ",
    example: ""
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: "Filter appointment by time meeting from",
  })
  @IsOptional()
  @IsDateString()
  date_from?: Date

  @ApiPropertyOptional({
    description: "Filter appointment by time meeting to",
  })
  @IsOptional()
  @IsDateString()
  date_to?: Date

  @ApiPropertyOptional({
    description: "Filter appointment by status",
  })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus
}