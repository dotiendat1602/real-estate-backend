import { ApiPropertyOptional } from "@nestjs/swagger";
import { CityKey, ModeKey } from "../../libs/types/crawl-batdongsan.type";
import { IsEnum, IsOptional } from "class-validator";

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
}
