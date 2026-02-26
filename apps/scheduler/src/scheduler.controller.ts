import { Body, Controller, Get, Post } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CrawlBatdongsanManualDto } from './batdongsan-com-vn/dto/crawl-manual.dto';

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
    });
    return { message: 'Crawl job started' };
  }
}
