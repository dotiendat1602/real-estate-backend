import { Body, Controller, Get, Post } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CrawlBatdongsanManualDto } from './batdongsan-com-vn/dto/crawl-manual.dto';
import { BackfillNearbyUtilitiesDto } from './batdongsan-com-vn/dto/backfill-utility.dto';

@Controller()
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) { }

  @Get()
  getHello(): string {
    return this.schedulerService.getHello();
  }

  @Post('crawl/batdongsan')
  async triggerCrawl(
    @Body() body: CrawlBatdongsanManualDto,
  ) {
    await this.schedulerService.runCrawlManually({
      cities: body.cities as any,
      modes: body.modes as any,
      maxPagesPerCategory: body.maxPagesPerCategory,
      maxDetails: body.maxDetails,
    });
    return { message: 'Crawl job started' };
  }

  @Post('crawl/batdongsan/nearby-utilities/backfill')
  async backfillNearbyUtilities(
    @Body() body: BackfillNearbyUtilitiesDto,
  ) {
    const result = await this.schedulerService.backfillBatdongsanNearbyUtilities({
      limit: body?.limit,
    });
    return { message: 'Nearby utilities backfill accepted', result };
  }

  @Get('crawl/batdongsan/nearby-utilities/backfill/status')
  getNearbyUtilitiesBackfillStatus() {
    return this.schedulerService.getBatdongsanNearbyUtilitiesBackfillStatus();
  }
}
