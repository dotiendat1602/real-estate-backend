import { ApiPropertyOptional } from "@nestjs/swagger";
import { CityKey, ModeKey } from "../../libs/types/crawl-batdongsan.type";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class CrawlBatdongsanManualDto {
  @ApiPropertyOptional({
    description: 'List of city keys to crawl (e.g., HN, HCM). If empty, crawl all cities.',
    example: ['HN', 'HCM'],
  })
  @IsOptional()
  @IsEnum(['HN', 'HCM'], { each: true })
  cities?: CityKey[];

  @ApiPropertyOptional({
    description: 'List of mode keys to crawl (e.g., SALE, RENT). If empty, crawl all modes.',
    example: ['SALE', 'RENT'],
  })
  @IsOptional()
  @IsEnum(['SALE', 'RENT'], { each: true })
  modes?: ModeKey[];

  @ApiPropertyOptional({
    description: 'Number of list pages to crawl per category for this manual run.',
    example: 4,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPagesPerCategory?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of detail URLs to process for this manual run.',
    example: 500,
    minimum: 1,
    maximum: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  maxDetails?: number;
}
