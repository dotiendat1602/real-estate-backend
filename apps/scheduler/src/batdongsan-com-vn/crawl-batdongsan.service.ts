import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import os from 'os';
import { CityKey, CrawledProperty, CrawlSeed, ModeKey } from '../libs/types/crawl-batdongsan.type';

@Injectable()
export class CrawlBatdongsanService {
  private readonly logger = new Logger(CrawlBatdongsanService.name);

  private readonly baseUrl = 'https://batdongsan.com.vn';
  private readonly systemUserId = 1;

  // ✅ an toàn chống block: 1 (khi ổn định có thể tăng 2)
  private readonly concurrency = 2;

  // Crawl page 1..N mỗi category
  private readonly maxPagesPerCategory = 2;

  // N trang liên tiếp không có tin mới => dừng
  private readonly stopAfterEmptyPages = 3;

  // Nếu page không có link detail => dừng
  private readonly stopIfNoLinks = true;

  // Giới hạn total detail/day
  private readonly dailyHardLimit = 12000;

  // Playwright profile persistent dir
  private readonly userDataDir = path.join(os.tmpdir(), 'bds-playwright-profile');

  @Cron('0 30 2 * * *', { timeZone: 'Asia/Bangkok' })
  async crawlDaily() {
    await this.crawlProperties({
      cities: ['HN', 'HCM'],
      modes: ['SALE', 'RENT'],
    });
  }

  constructor(private readonly prisma: PrismaService) { }

  async crawlProperties(opts?: { cities?: CityKey[]; modes?: ModeKey[] }) {
    const startedAt = Date.now();
    this.logger.log('Starting crawl job for batdongsan.com.vn');

    const cities = opts?.cities?.length ? opts.cities : (['HN', 'HCM'] as CityKey[]);
    const modes = opts?.modes?.length ? opts.modes : (['SALE', 'RENT'] as ModeKey[]);
    const seeds = this.buildSeeds(cities, modes);

    let totalVisitedLinks = 0;
    let totalInsertedPosts = 0;
    let totalSkippedExisting = 0;
    let totalFailed = 0;

    // ✅ persistent context: giữ cookie/session
    const pw = await chromium.launchPersistentContext(this.userDataDir, {
      headless: false, // ✅ giảm bị chặn (research)
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      viewport: { width: 1366, height: 768 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    });

    await this.warmUpContext(pw);

    try {
      for (const seed of seeds) {
        const r = await this.crawlCategory(seed, {
          remainingBudget: this.dailyHardLimit - totalVisitedLinks,
          pw,
        });

        totalVisitedLinks += r.visited;
        totalInsertedPosts += r.inserted;
        totalSkippedExisting += r.skipped;
        totalFailed += r.failed;

        if (totalVisitedLinks >= this.dailyHardLimit) {
          this.logger.log(`Reached dailyHardLimit=${this.dailyHardLimit}. Stop.`);
          break;
        }
      }
    } finally {
      await pw.close();
    }

    this.logger.log(
      `Crawl done. visited=${totalVisitedLinks}, inserted=${totalInsertedPosts}, skipped=${totalSkippedExisting}, failed=${totalFailed}, took=${Date.now() - startedAt}ms`,
    );

    return {
      visited: totalVisitedLinks,
      inserted: totalInsertedPosts,
      skipped: totalSkippedExisting,
      failed: totalFailed,
      tookMs: Date.now() - startedAt,
    };
  }

  private buildSeeds(cities: CityKey[], modes: ModeKey[]): CrawlSeed[] {
    const SALE_CATS = [
      'ban-can-ho-chung-cu',
      // 'ban-nha-rieng',
      // 'ban-dat',
      // 'ban-dat-nen-du-an',
      // 'ban-biet-thu-lien-ke',
    ];

    const RENT_CATS = [
      'cho-thue-can-ho-chung-cu',
      // 'cho-thue-nha-rieng',
      // 'cho-thue-nha-tro-phong-tro',
      // 'cho-thue-van-phong',
      // 'cho-thue-cua-hang-ki-ot',
    ];

    const citySlug: Record<CityKey, string> = {
      HN: 'ha-noi',
      HCM: 'tp-hcm',
    };

    const out: CrawlSeed[] = [];
    for (const city of cities) {
      for (const mode of modes) {
        const catList = mode === 'SALE' ? SALE_CATS : RENT_CATS;
        for (const cat of catList) {
          out.push({
            city,
            mode,
            // ví dụ: /ban-can-ho-chung-cu-tp-hcm?vrs=1
            // vrs=1 là filter "Tin đã xác thực (uy tín cao)"
            categoryPath: `/${cat}-${citySlug[city]}?vrs=1`,
          });
        }
      }
    }

    const cityOrder: Record<CityKey, number> = { HN: 0, HCM: 1 };
    const modeOrder: Record<ModeKey, number> = { SALE: 0, RENT: 1 };
    out.sort((a, b) => cityOrder[a.city] - cityOrder[b.city] || modeOrder[a.mode] - modeOrder[b.mode]);

    return out;
  }

  // ---------------------------
  // Crawl category
  // ---------------------------
  private async crawlCategory(seed: CrawlSeed, ctx: { remainingBudget: number; pw: BrowserContext }) {
    const label = `[${seed.city}][${seed.mode}]${seed.categoryPath}`;
    this.logger.log(`Crawling category ${label}`);

    let visited = 0;
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    let emptyPagesInRow = 0;

    for (let pageNo = 1; pageNo <= this.maxPagesPerCategory; pageNo++) {
      if (visited >= ctx.remainingBudget) break;

      const listUrl = this.buildListUrl(seed.categoryPath, pageNo);
      this.logger.log(`${label} page=${pageNo} url=${listUrl}`);

      const links = await this.collectDetailLinksFromListPage(ctx.pw, listUrl);
      this.logger.log(`${label} page=${pageNo} extracted links=${links.length}`);

      if (!links.length) {
        if (this.stopIfNoLinks) break;
        emptyPagesInRow++;
        if (emptyPagesInRow >= this.stopAfterEmptyPages) break;
        continue;
      }

      const uniqLinks = [...new Set(links)];
      const takeLinks = uniqLinks.slice(0, Math.max(0, ctx.remainingBudget - visited));
      visited += takeLinks.length;

      const limit = pLimit(this.concurrency);
      const settled = await Promise.allSettled(
        takeLinks.map((url) => limit(() => this.crawlPropertyDetail(url, seed.mode, ctx.pw))),
      );

      let insertedInPage = 0;
      let skippedInPage = 0;
      let failedInPage = 0;

      for (const s of settled) {
        if (s.status === 'fulfilled') {
          if (s.value === 'inserted') insertedInPage++;
          else if (s.value === 'skipped') skippedInPage++;
          else failedInPage++;
        } else {
          failedInPage++;
        }
      }

      inserted += insertedInPage;
      skipped += skippedInPage;
      failed += failedInPage;

      if (insertedInPage === 0) emptyPagesInRow++;
      else emptyPagesInRow = 0;

      this.logger.log(
        `${label} page=${pageNo} done: links=${takeLinks.length}, inserted=${insertedInPage}, skipped=${skippedInPage}, failed=${failedInPage}, emptyPagesInRow=${emptyPagesInRow}`,
      );

      if (emptyPagesInRow >= this.stopAfterEmptyPages) {
        this.logger.log(`${label} stop: ${emptyPagesInRow} empty pages in a row`);
        break;
      }

      await this.sleep(700 + Math.floor(Math.random() * 900));
    }

    return { visited, inserted, skipped, failed };
  }

  private buildListUrl(categoryPath: string, pageNo: number) {
    if (pageNo <= 1) return `${this.baseUrl}${categoryPath}`;
    return `${this.baseUrl}${categoryPath}/p${pageNo}`;
  }

  // ---------------------------
  // Listing: Playwright => lấy link -prXXXX
  // ---------------------------
  private async collectDetailLinksFromListPage(pw: BrowserContext, listUrl: string): Promise<string[]> {
    const page = await pw.newPage();
    try {
      await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2200);

      // scroll nhẹ (lazy load)
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(800);

      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
      const links = hrefs
        .filter((h) => h.startsWith('https://batdongsan.com.vn/'))
        .filter((h) => /-pr\d+(?:\?|$)/i.test(h))
        .map((h) => h.split('?')[0]);

      return [...new Set(links)];
    } catch (e: any) {
      this.logger.error(`Playwright list failed url=${listUrl} err=${e?.message || e}`);
      return [];
    } finally {
      await page.close();
    }
  }

  // ---------------------------
  // Detail: Playwright content => cheerio parse => save db
  // ---------------------------
  private async crawlPropertyDetail(
    detailUrl: string,
    mode: ModeKey,
    pw: BrowserContext,
  ): Promise<'inserted' | 'skipped' | 'failed'> {
    const fullUrl = detailUrl.startsWith('http') ? detailUrl : `${this.baseUrl}${detailUrl}`;

    const html = await this.fetchHtmlWithPlaywright(pw, fullUrl);
    if (!html) return 'failed';

    // ✅ sourceUid: ưu tiên "Mã tin" (fallback từ -pr)
    const maTin = this.extractMaTinFromHtml(html);
    const prId = this.extractPrIdFromUrl(fullUrl);
    const sourceUid = maTin || prId;

    if (!sourceUid) {
      this.logger.error(`No sourceUid (maTin/pr) url=${fullUrl}`);
      return 'failed';
    }

    // check exist by sourceUid
    const exists = await this.prisma.post.findFirst({
      where: { source: 'BATDONGSAN', sourceUid, deletedAt: null },
      select: { id: true },
    });
    if (exists) return 'skipped';

    try {
      const $ = cheerio.load(html);
      const data = this.parseDetail($, html, fullUrl, sourceUid);

      if (!data.title || data.title.trim().length < 4) {
        this.logger.error(`Parse empty title url=${fullUrl}`);
        return 'failed';
      }

      await this.saveToDb(data, mode);

      // throttle per detail
      await this.sleep(900 + Math.floor(Math.random() * 900));
      return 'inserted';
    } catch (e: any) {
      this.logger.error(`Detail failed url=${fullUrl} uid=${sourceUid} err=${e?.message || e}`);
      return 'failed';
    }
  }

  private async fetchHtmlWithPlaywright(pw: BrowserContext, url: string): Promise<string | null> {
    const page = await pw.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);

      // chờ thêm nếu chưa thấy h1
      const hasH1 = await page.locator('h1').first().isVisible().catch(() => false);
      if (!hasH1) await page.waitForTimeout(3500);

      const hasH1After = await page.locator('h1').first().isVisible().catch(() => false);
      if (!hasH1After) {
        const title = await page.title().catch(() => '');
        const htmlSmall = (await page.content()).slice(0, 700).toLowerCase();
        if (htmlSmall.includes('just a moment') || htmlSmall.includes('captcha') || htmlSmall.includes('cloudflare')) {
          this.logger.error(`PW challenge/captcha url=${url} title=${title}`);
          return null;
        }
        this.logger.error(`PW no-h1 url=${url} title=${title}`);
        return null;
      }

      return await page.content();
    } catch (e: any) {
      this.logger.error(`PW fetch failed url=${url} err=${e?.message || e}`);
      return null;
    } finally {
      await page.close();
    }
  }

  // ---------------------------
  // Parse detail
  // ---------------------------
  private parseDetail($: cheerio.CheerioAPI, html: string, sourceUrl: string, sourceUid: string): CrawledProperty {
    const title = $('h1').first().text().trim();

    const description =
      this.firstNonEmptyText($, [
        '.re__detail-content',
        '.re__detail-content-wrapper',
        '.re__pr-description',
        '[class*="description"]',
      ]) || '';

    const location =
      this.firstNonEmptyText($, [
        '.re__pr-short-description',
        '.re__detail-location',
        '.re__pr-address',
        '[class*="address"]',
      ]) || '';

    const rawPriceText =
      this.firstNonEmptyText($, ['.re__pr-short-price', '.re__pr-price', '[class*="price"]']) || '';
    const rawAreaText =
      this.firstNonEmptyText($, ['.re__pr-short-area', '.re__pr-area', '[class*="area"]']) || '';

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    const price = this.parsePrice(rawPriceText) ?? this.parsePriceFromText(bodyText);
    const area = this.parseArea(rawAreaText) ?? this.parseAreaFromText(bodyText);

    const images = this.extractImages($);

    const details = {
      ...this.extractKeyValueDetails($),
      ...this.extractPropertyFeaturesFromSection($),
    };

    const legalRaw = details['pháp lý'] || details['phap ly'];
    const furnitureRaw = details['nội thất'] || details['noi that'];

    const legalStatus = this.mapLegalStatus(legalRaw);
    const furnitureStatus = this.mapFurnitureStatus(furnitureRaw);

    const { lat, lon } = this.extractLatLonFromHtml(html);

    return {
      title,
      price,
      area,
      location,
      description,
      sourceUrl,
      sourceUid,

      bedroomNumber: this.parseNumber(details['số phòng ngủ'] || details['phòng ngủ']),
      toiletNumber: this.parseNumber(
        details['số phòng tắm, vệ sinh'] || details['số toilet'] || details['toilet'] || details['wc'],
      ),
      floorNumber: this.parseNumber(details['số tầng'] || details['tầng']),
      frontage: this.parseDecimal(details['mặt tiền']),
      roadWidth: this.parseDecimal(details['đường vào'] || details['độ rộng đường']),

      legalStatus,
      furnitureStatus,

      lat,
      lon,

      propertyType: details['loại hình nhà ở'] || details['loại hình'] || '',
      images,
      contactInfo: this.firstNonEmptyText($, ['.re__contact-name', '.js__contact-name', '[class*="contact"]']) || '',

      rawPriceText,
      rawAreaText,
    };
  }

  // ---------------------------
  // Save to DB
  // ---------------------------
  private async saveToDb(data: CrawledProperty, mode: ModeKey) {
    // categoryId: match theo propertyType (fallback 1)
    const category = data.propertyType
      ? await this.prisma.propertyCategory.findFirst({
        where: { categoryName: { contains: data.propertyType } },
        select: { id: true },
      })
      : null;

    const categoryId = category?.id || 1;

    // ✅ tạo property + post
    const property = await this.prisma.property.create({
      data: {
        title: data.title,
        description: data.description || null,
        price: data.price ?? 0,
        area: data.area,
        bedroomNumber: data.bedroomNumber,
        toiletNumber: data.toiletNumber,
        floorNumber: data.floorNumber,
        frontage: data.frontage,
        roadWidth: data.roadWidth,
        furnitureStatus: data.furnitureStatus,
        legalStatus: data.legalStatus,
        lat: data.lat,
        lon: data.lon,
        location: data.location,
        categoryId,
        createdById: this.systemUserId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    await this.prisma.post.create({
      data: {
        propertyId: property.id,
        postTitle: data.title,
        postType: mode === 'SALE' ? 'SALE' : 'RENT',
        postContent: data.description || null,
        postStatus: 'PENDING',
        createdById: this.systemUserId,
        source: 'BATDONGSAN',
        sourceUrl: data.sourceUrl,
        sourceUid: data.sourceUid,
      },
    });

    if (data.images?.length) {
      await this.prisma.propertyImage.createMany({
        data: data.images.map((url, idx) => ({
          propertyId: property.id,
          imageUrl: url,
          isPrimary: idx === 0,
        })),
        skipDuplicates: true,
      });
    }
  }

  // ---------------------------
  // Extractors
  // ---------------------------

  private extractMaTinFromHtml(html: string): string | null {
    const m2 = html.match(/Mã\s*tin\s*([0-9]{6,})/i);
    if (m2?.[1]) return m2[1];

    const m1 = html.match(/Mã\s*tin[\s\S]{0,200}?([0-9]{6,})/i);
    if (m1?.[1]) return m1[1];

    return null;
  }

  private extractPrIdFromUrl(url: string): string | null {
    const m = url.match(/-pr(\d+)(?:\?|$)/i);
    return m?.[1] || null;
  }

  private extractImages($: cheerio.CheerioAPI): string[] {
    const urls: string[] = [];
    $('img[src]').each((_, img) => {
      const srcRaw = ($(img).attr('src') || '').trim();
      if (!srcRaw) return;

      const src = srcRaw.startsWith('//') ? `https:${srcRaw}` : srcRaw;
      if (!src.startsWith('http')) return;

      // chỉ lấy ảnh thật
      if (!src.includes('file4.batdongsan.com.vn')) return;

      urls.push(src.split('?')[0]);
    });

    return [...new Set(urls)].slice(0, 50);
  }

  // Section "Đặc điểm bất động sản"
  private extractPropertyFeaturesFromSection($: cheerio.CheerioAPI): Record<string, string> {
    const heading = $('*')
      .filter((_, el) => $(el).text().trim() === 'Đặc điểm bất động sản')
      .first();

    if (!heading.length) return {};

    const container = heading.closest('section').length ? heading.closest('section') : heading.parent();
    const out: Record<string, string> = {};

    // Heuristic: tìm các node có 2 text con (label + value)
    container.find('*').each((_, el) => {
      const node = $(el);
      const childrenText = node
        .children()
        .map((_, c) => $(c).text().trim())
        .get()
        .filter(Boolean);

      if (childrenText.length >= 2) {
        const label = this.normalizeKey(childrenText[0]);
        const value = childrenText[1].trim();
        if (label && value && !out[label]) out[label] = value;
      }
    });

    return out;
  }

  // Heuristic cũ: label:value
  private extractKeyValueDetails($: cheerio.CheerioAPI): Record<string, string> {
    const out: Record<string, string> = {};
    const candidates = ['.re__pr-specs-content', '.re__detail-specs', '[class*="spec"]', '[class*="config"]', 'table'];

    for (const sel of candidates) {
      const text = $(sel).text();
      if (!text) continue;

      const lines = text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const line of lines) {
        const idx = line.indexOf(':');
        if (idx <= 0) continue;
        const k = this.normalizeKey(line.slice(0, idx));
        const v = line.slice(idx + 1).trim();
        if (k && v && !out[k]) out[k] = v;
      }
    }

    return out;
  }

  private normalizeKey(s: string) {
    return (s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .trim();
  }

  private firstNonEmptyText($: cheerio.CheerioAPI, selectors: string[]): string | null {
    for (const sel of selectors) {
      const t = $(sel).first().text().trim();
      if (t) return t;
    }
    return null;
  }

  // ---------------------------
  // Lat/Lon extract
  // ---------------------------
  private extractLatLonFromHtml(html: string): { lat?: number; lon?: number } {
    const decodedHtml = (html || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // 0) iframe google embed v1: .../maps/embed/v1/place?q=LAT,LON&key=...
    // BĐS hay để trong data-src (lazyload), đôi khi là src
    const iframeUrlMatch =
      decodedHtml.match(/<iframe[^>]+data-src="([^"]+)"/i) ||
      decodedHtml.match(/<iframe[^>]+src="([^"]+)"/i) ||
      decodedHtml.match(/<iframe[^>]+data-src='([^']+)'/i) ||
      decodedHtml.match(/<iframe[^>]+src='([^']+)'/i);

    if (iframeUrlMatch?.[1]) {
      const iframeUrl = iframeUrlMatch[1];
      try {
        const u = new URL(iframeUrl);

        // case embed v1 place
        // https://www.google.com/maps/embed/v1/place?q=10.7790,106.7153&key=...
        const q = u.searchParams.get('q');
        if (q) {
          // q có thể là "lat,lon" hoặc là text địa điểm
          const m = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
          if (m?.[1] && m?.[2]) {
            const lat = Number(m[1]);
            const lon = Number(m[2]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
          }
        }
      } catch {
        // ignore
      }
    }

    // 0.5) Nếu iframeUrlMatch fail do html lạ, fallback regex trực tiếp trong decodedHtml
    // q=LAT,LON
    const qPair = decodedHtml.match(/maps\/embed\/v1\/place\?[^"'<>]*\bq=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if (qPair?.[1] && qPair?.[2]) {
      const lat = Number(qPair[1]);
      const lon = Number(qPair[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    // 1) href maps.google.com ...?ll=LAT,LON
    const hrefMatch =
      decodedHtml.match(/href="(https?:\/\/maps\.google\.com\/maps\?[^"]+)"/i) ||
      decodedHtml.match(/href='(https?:\/\/maps\.google\.com\/maps\?[^']+)'/i);

    if (hrefMatch?.[1]) {
      try {
        const u = new URL(hrefMatch[1]);
        const ll = u.searchParams.get('ll');
        if (ll) {
          const [latS, lonS] = ll.split(',').map((x) => x.trim());
          const lat = Number(latS);
          const lon = Number(lonS);
          if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
        }

        const q = u.searchParams.get('q');
        if (q) {
          const m = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
          if (m?.[1] && m?.[2]) {
            const lat = Number(m[1]);
            const lon = Number(m[2]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
          }
        }
      } catch {
        // ignore
      }
    }

    // 2) json lat/lng
    const latM = decodedHtml.match(/"lat"\s*:\s*(-?[0-9.]+)/i);
    const lngM = decodedHtml.match(/"lng"\s*:\s*(-?[0-9.]+)/i);
    if (latM?.[1] && lngM?.[1]) {
      const lat = Number(latM[1]);
      const lon = Number(lngM[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    // 3) DMS text: 21°01'23.7"N 105°48'22.6"E
    const dmsRe =
      /(\d{1,2})°\s*(\d{1,2})'\s*([\d.]+)"?\s*([NS])\s*(\d{1,3})°\s*(\d{1,2})'\s*([\d.]+)"?\s*([EW])/i;

    const m = decodedHtml.match(dmsRe);
    if (m) {
      const lat = this.dmsToDecimal(Number(m[1]), Number(m[2]), Number(m[3]), m[4].toUpperCase());
      const lon = this.dmsToDecimal(Number(m[5]), Number(m[6]), Number(m[7]), m[8].toUpperCase());
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    // 4) iframe google map: !3dLAT!4dLON
    const iframe = decodedHtml.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (iframe?.[1] && iframe?.[2]) {
      const lat = Number(iframe[1]);
      const lon = Number(iframe[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    return {};
  }

  private dmsToDecimal(d: number, m: number, s: number, dir: string): number {
    const dec = d + m / 60 + s / 3600;
    const neg = dir === 'S' || dir === 'W';
    return neg ? -dec : dec;
  }

  // ---------------------------
  // Price/Area parsers
  // ---------------------------
  private parsePrice(priceText: string): number | undefined {
    const t = (priceText || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!t || t.includes('thỏa thuận')) return undefined;

    const numMatch = t.replace(/\./g, '').match(/[\d]+(?:[.,]\d+)?/);
    if (!numMatch) return undefined;

    const n = Number(numMatch[0].replace(',', '.'));
    if (!Number.isFinite(n)) return undefined;

    // giá /m2 -> bỏ (cần area để suy ra tổng)
    if (t.includes('/m') || t.includes('m²')) return undefined;

    if (t.includes('tỷ')) return Math.round(n * 1_000_000_000);
    if (t.includes('triệu')) return Math.round(n * 1_000_000);
    if (t.includes('nghìn')) return Math.round(n * 1_000);
    return undefined;
  }

  private parsePriceFromText(bodyText: string): number | undefined {
    const t = (bodyText || '').toLowerCase();

    const mTy = t.replace(/\./g, '').match(/([\d]+(?:[.,]\d+)?)\s*tỷ/);
    if (mTy) {
      const n = Number(mTy[1].replace(',', '.'));
      if (Number.isFinite(n)) return Math.round(n * 1_000_000_000);
    }

    const mTr = t.replace(/\./g, '').match(/([\d]+(?:[.,]\d+)?)\s*triệu/);
    if (mTr) {
      const n = Number(mTr[1].replace(',', '.'));
      if (Number.isFinite(n)) return Math.round(n * 1_000_000);
    }

    return undefined;
  }

  private parseArea(areaText: string): number | undefined {
    const t = (areaText || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const m = t.replace(/\./g, '').match(/([\d]+(?:[.,]\d+)?)\s*(m2|m²)/i);
    if (!m) return undefined;
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  private parseAreaFromText(bodyText: string): number | undefined {
    const t = (bodyText || '').toLowerCase().replace(/\s+/g, ' ');
    const m = t.replace(/\./g, '').match(/([\d]+(?:[.,]\d+)?)\s*(m2|m²)/i);
    if (!m) return undefined;
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  private parseNumber(text?: string): number | undefined {
    if (!text) return undefined;
    const m = text.match(/\d+/);
    return m ? parseInt(m[0], 10) : undefined;
  }

  private parseDecimal(text?: string): number | undefined {
    if (!text) return undefined;
    const m = text.replace(/\./g, '').match(/[\d]+(?:[.,]\d+)?/);
    if (!m) return undefined;
    const n = Number(m[0].replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  // ---------------------------
  // Map legal/furniture enums
  // ---------------------------
  private mapLegalStatus(raw?: string): CrawledProperty['legalStatus'] {
    const t = (raw || '').toLowerCase();
    if (!t) return undefined;

    const hasDo = t.includes('sổ đỏ');
    const hasHong = t.includes('sổ hồng');
    if (hasDo && hasHong) return 'OTHER';
    if (hasDo) return 'RED_BOOK';
    if (hasHong) return 'PINK_BOOK';

    if (t.includes('freehold')) return 'FREEHOLD';
    if (t.includes('leasehold')) return 'LEASEHOLD';
    return 'OTHER';
  }

  private mapFurnitureStatus(raw?: string): CrawledProperty['furnitureStatus'] {
    const t = (raw || '').toLowerCase();
    if (!t) return undefined;

    if (t.includes('đầy đủ') || t.includes('full')) return 'FULLY_FURNISHED';
    if (t.includes('cơ bản') || t.includes('một phần') || t.includes('part')) return 'PARTLY_FURNISHED';
    if (t.includes('không') || t.includes('trống')) return 'UNFURNISHED';
    return undefined;
  }

  // ---------------------------
  // Warm-up
  // ---------------------------
  private async warmUpContext(pw: BrowserContext) {
    const page = await pw.newPage();
    try {
      await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2200);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(900);
    } catch (e: any) {
      this.logger.error(`warmUp failed: ${e?.message || e}`);
    } finally {
      await page.close();
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
}
