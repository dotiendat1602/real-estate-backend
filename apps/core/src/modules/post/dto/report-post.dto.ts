import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReportStatus } from "@prisma/client";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ReportPostDto {
  @ApiPropertyOptional({
    description: 'The ID of the reporter (user who reports the post) or null if anonymous',
  })
  @IsOptional()
  @IsInt()
  reporterId?: number;

  @ApiProperty({
    description: 'The reason for reporting the post',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class UpdateReportDto {
  @ApiProperty({
    description: 'The status of the report',
    example: ReportStatus.RESOLVED,
  })
  @IsNotEmpty()
  @IsEnum(ReportStatus)
  status: ReportStatus;
}
