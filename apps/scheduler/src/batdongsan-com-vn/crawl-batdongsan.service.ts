import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

import { CityKey, CrawledProperty, CrawlSeed, ModeKey } from "../libs/types/crawl-batdongsan.type";
import {
  dmsToDecimal,
  mapFurnitureStatus,
  mapLegalStatus,
  parseArea,
  parseAreaFromText,
  parseNumber,
  parseDecimal,
  parsePrice,
  parsePriceFromText,
  formatDescription,
  mapOrientation,
  normalizeKey,
} from "../libs/helpers";

@Injectable()
export class CrawlBatdongsanService {
  private readonly logger = new Logger(CrawlBatdongsanService.name);

  private readonly baseUrl = "https://batdongsan.com.vn";
  private readonly systemUserId = 1;

  // an toàn chống block: 1 (khi ổn định có thể tăng 2)
  private readonly concurrency = 2;

  // Crawl page 1..N mỗi category
  private readonly maxPagesPerCategory = 2;

  // N trang liên tiếp không có tin mới => dừng
  private readonly stopAfterEmptyPages = 3;

  // Nếu page không có link detail => dừng
  private readonly stopIfNoLinks = true;

  // Giới hạn total detail/day
  private readonly dailyHardLimit = 12000;

  // private readonly userDataDir = path.join(os.tmpdir(), "bds-playwright-profile");
  private readonly userDataDir = path.resolve(process.cwd(), ".pw-bds-profile");

  private readonly accessToken = process.env.BATDONGSAN_ACCESS_TOKEN || "";
  private readonly refreshToken = process.env.BATDONGSAN_REFRESH_TOKEN || "";

  @Cron("0 30 2 * * *", { timeZone: "Asia/Bangkok" })
  async crawlDaily() {
    await this.crawlProperties({
      cities: ["HN", "HCM"],
      modes: ["SALE", "RENT"],
    });
  }

  constructor(private readonly prisma: PrismaService) { }

  async crawlProperties(opts?: { cities?: CityKey[]; modes?: ModeKey[] }) {
    const startedAt = Date.now();
    this.logger.log("Starting crawl job for batdongsan.com.vn");

    const cities = opts?.cities?.length ? opts.cities : (["HN", "HCM"] as CityKey[]);
    const modes = opts?.modes?.length ? opts.modes : (["SALE", "RENT"] as ModeKey[]);
    const seeds = this.buildSeeds(cities, modes);

    let totalVisitedLinks = 0;
    let totalInsertedPosts = 0;
    let totalSkippedExisting = 0;
    let totalFailed = 0;

    await this.ensureProfileDir();

    const pw = await chromium.launchPersistentContext(this.userDataDir, {
      headless: false,
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
      viewport: { width: 1366, height: 768 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });

    try {
      // đảm bảo login bằng persistent profile
      await this.ensureLoggedIn(pw);

      // warm up
      await this.warmUpContext(pw);

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

  private async ensureProfileDir() {
    if (!fs.existsSync(this.userDataDir)) {
      await fsp.mkdir(this.userDataDir, { recursive: true });
    }
  }

  /**
   * ✅ Detect login state:
   * - Nếu đã login rồi => return
   * - Nếu chưa login => mở UI và chờ bạn login tay 1 lần
   * - Login xong => ghi marker .logged-in
   */
  private async ensureLoggedIn(pw: BrowserContext) {
    const page = await pw.newPage();
    try {
      await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);

      const loggedIn = await this.isLoggedIn(page);
      if (loggedIn) {
        this.logger.log("✅ Already logged in (persistent profile).");
        return;
      }

      this.logger.warn("⚠️ Not logged in. Please login manually in the opened browser window...");

      await page.bringToFront();

      // phỉa login tay trước
      await page.waitForSelector("#kct_login", { state: "detached", timeout: 10 * 60 * 1000 }).catch(async () => {
        // có thể không detached nhưng hidden => check thêm
        await page.waitForSelector("#kct_login", { state: "hidden", timeout: 10 * 60 * 1000 });
      });

      const loggedInAfter = await this.isLoggedIn(page);
      if (loggedInAfter) {
        this.logger.log("✅ Login detected (kct_login disappeared).");
      } else {
        this.logger.warn("Login detection uncertain, but session might still be set.");
      }
    } catch (e: any) {
      this.logger.error(`ensureLoggedIn failed: ${e?.message || e}`);
    } finally {
      await page.close();
    }
  }

  private async isLoggedIn(page: Page): Promise<boolean> {
    // Nếu thấy nút đăng nhập (#kct_login) => chắc chắn chưa login
    const loginVisible = await page.locator("#kct_login").isVisible().catch(() => false);
    if (loginVisible) return false;

    // Nếu không thấy #kct_login nữa => rất có thể đã login
    // (thường UI sẽ render block username/avatar khác)
    const containerExists = await page.locator("#divUserStt").count().catch(() => 0);

    // container còn nhưng không có login button => coi như logged in
    if (containerExists > 0) return true;

    // fallback nhẹ: nếu không còn div này thì cũng coi như logged in (site đổi layout)
    return true;
  }

  private buildSeeds(cities: CityKey[], modes: ModeKey[]): CrawlSeed[] {
    const SALE_CATS = ["ban-can-ho-chung-cu"];
    const RENT_CATS = ["cho-thue-can-ho-chung-cu"];

    const citySlug: Record<CityKey, string> = { HN: "ha-noi", HCM: "tp-hcm" };

    const out: CrawlSeed[] = [];
    for (const city of cities) {
      for (const mode of modes) {
        const catList = mode === "SALE" ? SALE_CATS : RENT_CATS;
        for (const cat of catList) {
          out.push({
            city,
            mode,
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
        if (s.status === "fulfilled") {
          if (s.value === "inserted") insertedInPage++;
          else if (s.value === "skipped") skippedInPage++;
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
      await page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2200);

      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(800);

      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href));
      const links = hrefs
        .filter((h) => h.startsWith("https://batdongsan.com.vn/"))
        .filter((h) => /-pr\d+(?:\?|$)/i.test(h))
        .map((h) => h.split("?")[0]);

      return [...new Set(links)];
    } catch (e: any) {
      this.logger.error(`Playwright list failed url=${listUrl} err=${e?.message || e}`);
      return [];
    } finally {
      await page.close();
    }
  }

  // ---------------------------
  // Detail: open page => click reveal phone span => parse html => save db
  // ---------------------------
  private async crawlPropertyDetail(
    detailUrl: string,
    mode: ModeKey,
    pw: BrowserContext,
  ): Promise<"inserted" | "skipped" | "failed"> {
    const fullUrl = detailUrl.startsWith("http") ? detailUrl : `${this.baseUrl}${detailUrl}`;
    const page = await pw.newPage();

    try {
      const html0 = await this.fetchHtmlWithPlaywright(page, fullUrl);
      if (!html0) return "failed";

      const maTin = this.extractMaTinFromHtml(html0);
      const prId = this.extractPrIdFromUrl(fullUrl);
      const sourceUid = maTin || prId;

      if (!sourceUid) {
        this.logger.error(`No sourceUid (maTin/pr) url=${fullUrl}`);
        return "failed";
      }

      const exists = await this.prisma.post.findFirst({
        where: { source: "BATDONGSAN", sourceUid, deletedAt: null },
        select: { id: true },
      });
      if (exists) return "skipped";

      // click để hiện full phone (chỉ để description có full text, không lưu)
      await this.revealPhoneForDescription(page);

      const htmlAfter = await page.content();
      const $ = cheerio.load(htmlAfter);

      const data = this.parseDetail($, htmlAfter, fullUrl, sourceUid);

      if (!data.title || data.title.trim().length < 4) {
        this.logger.error(`Parse empty title url=${fullUrl}`);
        return "failed";
      }

      await this.saveToDb(data, mode);

      await this.sleep(900 + Math.floor(Math.random() * 900));
      return "inserted";
    } catch (e: any) {
      this.logger.error(`Detail failed url=${fullUrl} err=${e?.message || e}`);
      return "failed";
    } finally {
      await page.close();
    }
  }

  private async fetchHtmlWithPlaywright(page: Page, url: string): Promise<string | null> {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);

      const hasH1 = await page.locator("h1").first().isVisible().catch(() => false);
      if (!hasH1) await page.waitForTimeout(3500);

      const hasH1After = await page.locator("h1").first().isVisible().catch(() => false);
      if (!hasH1After) {
        const title = await page.title().catch(() => "");
        const htmlSmall = (await page.content()).slice(0, 900).toLowerCase();
        if (htmlSmall.includes("just a moment") || htmlSmall.includes("captcha") || htmlSmall.includes("cloudflare")) {
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
    }
  }

  // ---------------------------
  // Reveal phone: click span.hidden-phone.js__btn-tracking
  // ---------------------------
  private async revealPhoneForDescription(page: Page): Promise<void> {
    const selector = "span.hidden-phone.js__btn-tracking, span.js__btn-tracking.hidden-phone";
    const loc = page.locator(selector).first();
    const count = await loc.count().catch(() => 0);
    if (!count) return;

    try {
      await loc.scrollIntoViewIfNeeded().catch(() => null);

      const beforeText = (await loc.innerText().catch(() => "")) || "";

      await loc.click({ timeout: 5000 }).catch(() => null);

      // chờ cho đến khi có mobile attr hoặc text không còn ***
      await page
        .waitForFunction(
          (arg: { sel: string; prev: string }) => {
            const el = document.querySelector(arg.sel) as HTMLElement | null;
            if (!el) return false;

            const txt = (el.innerText || "").trim();
            const mobile = el.getAttribute("mobile") || "";

            if (mobile.trim().length >= 8) return true;
            if (txt && !txt.includes("***") && txt !== arg.prev) return true;

            return false;
          },
          { sel: selector, prev: beforeText },
          { timeout: 7000 },
        )
        .catch(() => null);

      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return;

        const txt = (el.innerText || "").trim().toLowerCase();
        const mobile = el.getAttribute("mobile") || "";

        if (txt.includes("đã sao chép") && mobile.trim().length >= 8) {
          el.innerText = mobile;
        }
      }, selector);

      await page.waitForTimeout(150);
    } catch {
      // ignore
    }
  }

  // ---------------------------
  // Parse detail
  // ---------------------------
  private parseDetail($: cheerio.CheerioAPI, html: string, sourceUrl: string, sourceUid: string): CrawledProperty {
    const title = $("h1").first().text().trim();

    const description =
      this.firstNonEmptyText($, [
        ".re__detail-content",
        ".re__detail-content-wrapper",
        ".re__pr-description",
        '[class*="description"]',
      ]) || "";

    const formattedDescription = formatDescription(description);

    const location =
      this.firstNonEmptyText($, [
        ".re__pr-short-description",
        ".re__detail-location",
        ".re__pr-address",
        '[class*="address"]',
      ]) || "";

    const rawPriceText = this.firstNonEmptyText($, [".re__pr-short-price", ".re__pr-price", '[class*="price"]']) || "";
    const rawAreaText = this.firstNonEmptyText($, [".re__pr-short-area", ".re__pr-area", '[class*="area"]']) || "";

    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const price = parsePrice(rawPriceText) ?? parsePriceFromText(bodyText);
    const area = parseArea(rawAreaText) ?? parseAreaFromText(bodyText);

    const images = this.extractImages($);

    const details = {
      ...this.extractKeyValueDetails($),
      ...this.extractPropertyFeaturesFromSection($),
    };

    const legalRaw = details["pháp lý"] || details["phap ly"];
    const furnitureRaw = details["nội thất"] || details["noi that"];
    const orientationRaw = details["hướng nhà"] || details["huong nha"];

    const legalStatus = mapLegalStatus(legalRaw);
    const furnitureStatus = mapFurnitureStatus(furnitureRaw);
    const orientationStatus = mapOrientation(orientationRaw);

    const { lat, lon } = this.extractLatLonFromHtml(html);

    return {
      title,
      price,
      area,
      location,
      description: formattedDescription,
      sourceUrl,
      sourceUid,

      bedroomNumber: parseNumber(details["số phòng ngủ"] || details["phòng ngủ"]),
      toiletNumber: parseNumber(details["số phòng tắm, vệ sinh"] || details["số toilet"] || details["toilet"] || details["wc"]),
      floorNumber: parseNumber(details["số tầng"] || details["tầng"]),
      frontage: parseDecimal(details["mặt tiền"]),
      roadWidth: parseDecimal(details["đường vào"] || details["độ rộng đường"]),

      legalStatus,
      furnitureStatus,
      orientation: orientationStatus,
      lat,
      lon,

      propertyType: details["loại hình nhà ở"] || details["loại hình"] || "",
      images,

      contactInfo: this.firstNonEmptyText($, [".re__contact-name", ".js__contact-name", '[class*="contact"]']) || "",

      rawPriceText,
      rawAreaText,
    };
  }

  // ---------------------------
  // Save to DB
  // ---------------------------
  private async saveToDb(data: CrawledProperty, mode: ModeKey) {
    const category = data.propertyType
      ? await this.prisma.propertyCategory.findFirst({
        where: { categoryName: { contains: data.propertyType } },
        select: { id: true },
      })
      : null;

    const categoryId = category?.id || 1;

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
        orientation: data.orientation,
        lat: data.lat,
        lon: data.lon,
        location: data.location,
        categoryId,
        createdById: this.systemUserId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await this.prisma.post.create({
      data: {
        propertyId: property.id,
        postTitle: data.title,
        postType: mode === "SALE" ? "SALE" : "RENT",
        postContent: data.description || null,
        postStatus: "PENDING",
        createdById: this.systemUserId,
        source: "BATDONGSAN",
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
  // Auth via COOKIES (cookie name fixed)
  // ---------------------------
  private async ensureAuthCookies(pw: BrowserContext) {
    const access = this.accessToken;
    const refresh = this.refreshToken;

    if (!access && !refresh) {
      this.logger.warn("No BATDONGSAN_ACCESS_TOKEN / BATDONGSAN_REFRESH_TOKEN in env. Skip cookie auth.");
      return;
    }

    const cookies: any[] = [];
    const domain = ".batdongsan.com.vn";

    if (access) {
      cookies.push({
        name: "accessToken",
        value: access,
        domain,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      });
    }

    if (refresh) {
      cookies.push({
        name: "refreshToken",
        value: refresh,
        domain,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      });
    }

    await pw.addCookies(cookies);

    const page = await pw.newPage();
    try {
      await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);
      this.logger.log(`Auth cookies injected: access=${access ? "yes" : "no"} refresh=${refresh ? "yes" : "no"}`);
    } catch (e: any) {
      this.logger.warn(`ensureAuthCookies failed: ${e?.message || e}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------
  // Extractors
  // ---------------------------
  private extractMaTinFromHtml(html: string): string | null {
    const m2 = html.match(/Mã\s*tin\s*([0-9]{6,})/i);
    if (m2?.[1]) return m2[1];

    const m1 = html.match(/Mã\s*tin[\s\S]{0,250}?([0-9]{6,})/i);
    if (m1?.[1]) return m1[1];

    const m3 = html.match(/"productId"\s*:\s*"?([0-9]{6,})"?/i);
    if (m3?.[1]) return m3[1];

    return null;
  }

  private extractPrIdFromUrl(url: string): string | null {
    const m = url.match(/-pr(\d+)(?:\?|$)/i);
    return m?.[1] || null;
  }

  private extractImages($: cheerio.CheerioAPI): string[] {
    const urls: string[] = [];
    $("img[src]").each((_, img) => {
      const srcRaw = ($(img).attr("src") || "").trim();
      if (!srcRaw) return;

      const src = srcRaw.startsWith("//") ? `https:${srcRaw}` : srcRaw;
      if (!src.startsWith("http")) return;

      if (!src.includes("file4.batdongsan.com.vn")) return;

      urls.push(src.split("?")[0]);
    });

    return [...new Set(urls)].slice(0, 50);
  }

  private extractPropertyFeaturesFromSection($: cheerio.CheerioAPI): Record<string, string> {
    const heading = $("*")
      .filter((_, el) => $(el).text().trim() === "Đặc điểm bất động sản")
      .first();

    if (!heading.length) return {};

    const container = heading.closest("section").length ? heading.closest("section") : heading.parent();
    const out: Record<string, string> = {};

    container.find("*").each((_, el) => {
      const node = $(el);
      const childrenText = node
        .children()
        .map((_, c) => $(c).text().trim())
        .get()
        .filter(Boolean);

      if (childrenText.length >= 2) {
        const label = normalizeKey(childrenText[0]);
        const value = childrenText[1].trim();
        if (label && value && !out[label]) out[label] = value;
      }
    });

    return out;
  }

  private extractKeyValueDetails($: cheerio.CheerioAPI): Record<string, string> {
    const out: Record<string, string> = {};
    const candidates = [".re__pr-specs-content", ".re__detail-specs", '[class*="spec"]', '[class*="config"]', "table"];

    for (const sel of candidates) {
      const text = $(sel).text();
      if (!text) continue;

      const lines = text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx <= 0) continue;
        const k = normalizeKey(line.slice(0, idx));
        const v = line.slice(idx + 1).trim();
        if (k && v && !out[k]) out[k] = v;
      }
    }

    return out;
  }

  private firstNonEmptyText($: cheerio.CheerioAPI, selectors: string[]): string | null {
    for (const sel of selectors) {
      const t = $(sel).first().text().trim();
      if (t) return t;
    }
    return null;
  }

  // ---------------------------
  // Lat/Lon extract (iframe embed v1 place)
  // ---------------------------
  private extractLatLonFromHtml(html: string): { lat?: number; lon?: number } {
    const decodedHtml = (html || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    const mapBlock = decodedHtml.match(
      /<div[^>]*class="re__section[^"]*re__pr-map[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i,
    )?.[0];

    const haystack = mapBlock || decodedHtml;

    const iframeUrlMatch =
      haystack.match(/<iframe[^>]+data-src="([^"]+)"/i) ||
      haystack.match(/<iframe[^>]+src="([^"]+)"/i) ||
      haystack.match(/<iframe[^>]+data-src='([^']+)'/i) ||
      haystack.match(/<iframe[^>]+src='([^']+)'/i);

    if (iframeUrlMatch?.[1]) {
      try {
        const u = new URL(iframeUrlMatch[1]);
        const q = u.searchParams.get("q");
        if (q) {
          const m = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
          if (m?.[1] && m?.[2]) {
            const lat = Number(m[1]);
            const lon = Number(m[2]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
          }
        }
      } catch { }
    }

    const qPair = haystack.match(/maps\/embed\/v1\/place\?[^"'<>]*\bq=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if (qPair?.[1] && qPair?.[2]) {
      const lat = Number(qPair[1]);
      const lon = Number(qPair[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    const dmsRe =
      /(\d{1,2})°\s*(\d{1,2})'\s*([\d.]+)"?\s*([NS])\s*(\d{1,3})°\s*(\d{1,2})'\s*([\d.]+)"?\s*([EW])/i;
    const m = haystack.match(dmsRe);
    if (m) {
      const lat = dmsToDecimal(Number(m[1]), Number(m[2]), Number(m[3]), m[4].toUpperCase());
      const lon = dmsToDecimal(Number(m[5]), Number(m[6]), Number(m[7]), m[8].toUpperCase());
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    const latM = haystack.match(/"lat"\s*:\s*(-?[0-9.]+)/i);
    const lngM = haystack.match(/"lng"\s*:\s*(-?[0-9.]+)/i);
    if (latM?.[1] && lngM?.[1]) {
      const lat = Number(latM[1]);
      const lon = Number(lngM[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    const iframe = haystack.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (iframe?.[1] && iframe?.[2]) {
      const lat = Number(iframe[1]);
      const lon = Number(iframe[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    return {};
  }

  // ---------------------------
  // Warm-up
  // ---------------------------
  private async warmUpContext(pw: BrowserContext) {
    const page = await pw.newPage();
    try {
      await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
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
