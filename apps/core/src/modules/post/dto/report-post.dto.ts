import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

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
