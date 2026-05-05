import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlBatdongsanService } from './batdongsan-com-vn/crawl-batdongsan.service';
import { CityKey, ModeKey } from './libs/types/crawl-batdongsan.type';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly crawlBatdongsanService: CrawlBatdongsanService,
  ) { }

  getHello(): string {
    return 'Scheduler Service is running!';
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCrawlBatdongsan() {
    this.logger.log('Starting daily crawl job for batdongsan.com.vn');
    try {
      await this.crawlBatdongsanService.crawlProperties();
    } catch (error) {
      this.logger.error('Error in crawl job', error);
    }
  }

  // Có thể test bằng cách chạy manual
  async runCrawlManually(query?: {
    cities?: CityKey[];
    modes?: ModeKey[];
    maxPagesPerCategory?: number;
    maxDetails?: number;
  }) {
    return this.crawlBatdongsanService.crawlProperties(query);
  }

  async backfillBatdongsanNearbyUtilities(query?: { limit?: number }) {
    return this.crawlBatdongsanService.startNearbyUtilitiesBackfill(query);
  }

  getBatdongsanNearbyUtilitiesBackfillStatus() {
    return this.crawlBatdongsanService.getNearbyUtilitiesBackfillStatus();
  }
}
