import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, Max, Min } from "class-validator";
import { PlanningIngestDto } from "./planning-ingest.dto";

export class PlanningBatchIngestDto extends PlanningIngestDto {
  @ApiProperty({
    type: [Number],
    example: [101, 205, 309],
    description: "Danh sach propertyId can ingest planning documents",
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  propertyIds!: number[];

  @ApiPropertyOptional({
    default: 5,
    minimum: 1,
    maximum: 20,
    description: "So luong property duoc chuan bi ingest song song",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  concurrency?: number;
}
