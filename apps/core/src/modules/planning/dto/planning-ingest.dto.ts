import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class PlanningIngestDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean = true;
}
