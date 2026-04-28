import { ApiPropertyOptional } from "@nestjs/swagger";
import { AppointmentStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateAppointmentDto {
  @ApiPropertyOptional({
    description: "",
    example: ""
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: Date

  @ApiPropertyOptional({
    description: "",
    example: ""
  })
  @IsOptional()
  @IsString()
  location?: string

  @ApiPropertyOptional({
    description: "",
    example: ""
  })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus

  @ApiPropertyOptional({
    description: "",
    example: ""
  })
  @IsOptional()
  @IsString()
  notes?: string
}
