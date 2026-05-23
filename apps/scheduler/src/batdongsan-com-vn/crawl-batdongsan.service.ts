import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { BrowserContext, Cookie, Page } from "playwright";
import { chromium } from "playwright-extra";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { UtilityCategory } from "@prisma/client";

import { CityKey, CrawlDetailResult, CrawledProperty, CrawlRunReport, CrawlSeed, LocationCache, LocationDistrict, LocationMatch, LocationProvince, ModeKey, NearbyPoi, NearbyPoiFetchResult, NearbyPoiSyncResult, NearbyUtilitiesBackfillResult, NearbyUtilitiesBackfillStatus, OverpassResponse, SeedAntiBotMetrics, SeedCircuitState } from "../libs/types/crawl-batdongsan.type";
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
import { NEARBY_POI_PER_CATEGORY_LIMIT, NEARBY_POI_RADIUS_M, OVERPASS_ABORT_COOLDOWN_MS, OVERPASS_API_URL, OVERPASS_RATE_LIMIT_COOLDOWN_MS, OVERPASS_SERVER_TIMEOUT_COOLDOWN_MS } from "../libs/constant";

chromium.use(StealthPlugin());


@Injectable()
export class CrawlBatdongsanService {
  private readonly logger = new Logger(CrawlBatdongsanService.name);

  private readonly baseUrl = "https://batdongsan.com.vn";
  private readonly systemUserId = 1;

  // base concurrency, sẽ tự giảm khi anti-bot phát hiện challenge cao
  private readonly configuredConcurrency = Math.max(1, Number(process.env.BATDONGSAN_CONCURRENCY || "2"));

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
  private readonly crawlReportDir = path.resolve(process.cwd(), "storage", "crawl-reports", "batdongsan");

  private readonly accessToken = process.env.BATDONGSAN_ACCESS_TOKEN || "";
  private readonly refreshToken = process.env.BATDONGSAN_REFRESH_TOKEN || "";
  private overpassQueue: Promise<void> = Promise.resolve();
  private lastOverpassRequestAt = 0;
  private overpassCooldownUntil = 0;
  private nearbyUtilitiesBackfillRunning = false;
  private nearbyUtilitiesBackfillStatus: NearbyUtilitiesBackfillStatus = {
    running: false,
  };

  private readonly userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  ];

  private navigationAttemptCount = 0;
  private challengeDetectedCount = 0;
  private consecutiveChallengeCount = 0;
  private seedCircuit = new Map<string, SeedCircuitState>();
  private locationCache: LocationCache | null = null;

  @Cron("0 30 2 * * *", { timeZone: "Asia/Bangkok" })
  async crawlDaily() {
    await this.crawlProperties({
      cities: ["HN", "HCM"],
      modes: ["SALE", "RENT"],
    });
  }

  constructor(private readonly prisma: PrismaService) { }

  async crawlProperties(opts?: {
    cities?: CityKey[];
    modes?: ModeKey[];
    maxPagesPerCategory?: number;
    maxDetails?: number;
  }) {
    const startedAt = Date.now();
    this.logger.log("Starting crawl job for batdongsan.com.vn");

    const cities = opts?.cities?.length ? opts.cities : (["HN", "HCM"] as CityKey[]);
    const modes = opts?.modes?.length ? opts.modes : (["SALE", "RENT"] as ModeKey[]);
    const maxPagesPerCategory = this.normalizeManualPageLimit(opts?.maxPagesPerCategory);
    const detailLimit = this.normalizeManualDetailLimit(opts?.maxDetails);
    const seeds = this.buildSeeds(cities, modes);

    let totalVisitedLinks = 0;
    let totalInsertedPosts = 0;
    let totalSkippedExisting = 0;
    let totalFailed = 0;
    let totalSeedsSkippedByCircuit = 0;

    const runId = this.buildReportRunId(startedAt);
    const reportFiles = await this.prepareReportFiles(runId);
    const report: CrawlRunReport = {
      startedAt: new Date(startedAt).toISOString(),
      reportVersion: "1.0.0",
      filters: { cities, modes },
      summary: {
        visited: 0,
        inserted: 0,
        skipped: 0,
        failed: 0,
        seedsCircuitSkipped: 0,
        challengeDetected: 0,
        challengeRatio: 0,
        tookMs: 0,
      },
      insertedItems: [],
      skippedItems: [],
      failedItems: [],
      files: {
        json: reportFiles.jsonPath,
        jsonl: reportFiles.jsonlPath,
      },
    };

    await this.ensureProfileDir();

    let pw: BrowserContext | null = await this.createBrowserContext();

    try {
      await this.bootstrapContext(pw);

      for (const seed of seeds) {
        if (totalVisitedLinks >= detailLimit) break;
        if (this.isSeedCoolingDown(seed)) {
          totalSeedsSkippedByCircuit += 1;
          continue;
        }

        let r: { visited: number; inserted: number; skipped: number; failed: number; metrics: SeedAntiBotMetrics } | null =
          null;

        r = await this.crawlCategory(seed, {
          remainingBudget: detailLimit - totalVisitedLinks,
          maxPagesPerCategory,
          pw,
          onDetailResult: async (detailResult) => {
            if (detailResult.status === "inserted") {
              report.insertedItems.push(detailResult);
            } else if (detailResult.status === "skipped") {
              report.skippedItems.push(detailResult);
            } else {
              report.failedItems.push(detailResult);
            }

            await this.appendReportLine(reportFiles.jsonlPath, detailResult);
          },
        });

        if (!r) {
          continue;
        }

        if (this.shouldTripSeedCircuit(r.metrics)) {
          const breaker = this.markSeedTrip(seed, "high challenge ratio", r.metrics);
          if (breaker.opened) {
            totalSeedsSkippedByCircuit += 1;
          }
        } else {
          this.markSeedHealthy(seed);
        }

        this.logger.log(
          `[AntiBot][${seed.city}/${seed.mode}] nav=${r.metrics.navigationAttempts} challenge=${r.metrics.challengeHits} ratio=${(
            r.metrics.challengeRatio *
            100
          ).toFixed(1)}%`,
        );

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
      if (pw) {
        await pw.close();
      }
    }

    this.logger.log(
      `Crawl done. visited=${totalVisitedLinks}, inserted=${totalInsertedPosts}, skipped=${totalSkippedExisting}, failed=${totalFailed}, took=${Date.now() - startedAt}ms`,
    );

    const finalChallengeRatio =
      this.navigationAttemptCount > 0 ? this.challengeDetectedCount / this.navigationAttemptCount : 0;
    this.logger.log(
      `[AntiBot][summary] nav=${this.navigationAttemptCount} challenge=${this.challengeDetectedCount} ratio=${(
        finalChallengeRatio *
        100
      ).toFixed(1)}% consecutiveChallenge=${this.consecutiveChallengeCount} seedsCircuitSkipped=${totalSeedsSkippedByCircuit}`,
    );

    report.finishedAt = new Date().toISOString();
    report.summary = {
      visited: totalVisitedLinks,
      inserted: totalInsertedPosts,
      skipped: totalSkippedExisting,
      failed: totalFailed,
      seedsCircuitSkipped: totalSeedsSkippedByCircuit,
      challengeDetected: this.challengeDetectedCount,
      challengeRatio: finalChallengeRatio,
      tookMs: Date.now() - startedAt,
    };
    await this.writeFinalReport(reportFiles.jsonPath, report);

    this.logger.log(`[Report] JSON: ${reportFiles.jsonPath}`);
    this.logger.log(`[Report] JSONL: ${reportFiles.jsonlPath}`);

    return {
      visited: totalVisitedLinks,
      inserted: totalInsertedPosts,
      skipped: totalSkippedExisting,
      failed: totalFailed,
      tookMs: Date.now() - startedAt,
      report: {
        jsonPath: reportFiles.jsonPath,
        jsonlPath: reportFiles.jsonlPath,
      },
    };
  }

  private async ensureProfileDir() {
    if (!fs.existsSync(this.userDataDir)) {
      await fsp.mkdir(this.userDataDir, { recursive: true });
    }
  }

  private buildReportRunId(ts = Date.now()): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  private async prepareReportFiles(runId: string): Promise<{ jsonPath: string; jsonlPath: string }> {
    await fsp.mkdir(this.crawlReportDir, { recursive: true });
    const jsonPath = path.join(this.crawlReportDir, `crawl-report-${runId}.json`);
    const jsonlPath = path.join(this.crawlReportDir, `crawl-report-${runId}.jsonl`);
    await fsp.writeFile(jsonlPath, "", "utf8");
    return { jsonPath, jsonlPath };
  }

  private async appendReportLine(jsonlPath: string, entry: CrawlDetailResult): Promise<void> {
    await fsp.appendFile(jsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  private async writeFinalReport(jsonPath: string, report: CrawlRunReport): Promise<void> {
    await fsp.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  private normalizeManualPageLimit(value?: number): number {
    if (!Number.isFinite(value)) return this.maxPagesPerCategory;
    return Math.min(20, Math.max(1, Math.trunc(Number(value))));
  }

  private normalizeManualDetailLimit(value?: number): number {
    if (!Number.isFinite(value)) return this.dailyHardLimit;
    return Math.min(this.dailyHardLimit, Math.max(1, Math.trunc(Number(value))));
  }

  private getSeedCircuitTripThreshold(): number {
    const raw = Number(process.env.BATDONGSAN_SEED_BREAKER_FAILURES || "2");
    if (!Number.isFinite(raw) || raw < 1) return 2;
    return Math.min(Math.floor(raw), 8);
  }

  private getSeedCircuitCooldownMs(): number {
    const raw = Number(process.env.BATDONGSAN_SEED_BREAKER_COOLDOWN_MS || `${15 * 60 * 1000}`);
    if (!Number.isFinite(raw) || raw < 1000) return 15 * 60 * 1000;
    return Math.min(Math.floor(raw), 6 * 60 * 60 * 1000);
  }

  private getSeedKey(seed: CrawlSeed): string {
    return `${seed.city}|${seed.mode}|${seed.categoryPath}`;
  }

  private getSeedCircuitState(seed: CrawlSeed): SeedCircuitState {
    const key = this.getSeedKey(seed);
    const existing = this.seedCircuit.get(key);
    if (existing) return existing;

    const initial: SeedCircuitState = {
      consecutiveTrips: 0,
      cooldownUntil: 0,
      openedCount: 0,
    };
    this.seedCircuit.set(key, initial);
    return initial;
  }

  private isSeedCoolingDown(seed: CrawlSeed): boolean {
    const state = this.getSeedCircuitState(seed);
    const now = Date.now();
    if (state.cooldownUntil <= now) return false;

    const remainSec = Math.ceil((state.cooldownUntil - now) / 1000);
    this.logger.error(
      `[Circuit][${seed.city}/${seed.mode}] skip seed due to cooldown ${remainSec}s (opened=${state.openedCount}, trips=${state.consecutiveTrips}, reason=${state.lastReason || "n/a"})`,
    );
    return true;
  }

  private markSeedHealthy(seed: CrawlSeed): void {
    const state = this.getSeedCircuitState(seed);
    if (state.consecutiveTrips !== 0 || state.cooldownUntil !== 0) {
      state.consecutiveTrips = 0;
      state.cooldownUntil = 0;
      state.lastReason = undefined;
    }
  }

  private markSeedTrip(seed: CrawlSeed, reason: string, metrics: SeedAntiBotMetrics): { opened: boolean; retryAt?: number } {
    const threshold = this.getSeedCircuitTripThreshold();
    const cooldownMs = this.getSeedCircuitCooldownMs();
    const state = this.getSeedCircuitState(seed);

    state.consecutiveTrips += 1;
    state.lastReason = `${reason}; ratio=${(metrics.challengeRatio * 100).toFixed(1)}%; hits=${metrics.challengeHits}`;

    if (state.consecutiveTrips < threshold) {
      this.logger.error(
        `[Circuit][${seed.city}/${seed.mode}] trip ${state.consecutiveTrips}/${threshold} (not opened yet): ${state.lastReason}`,
      );
      return { opened: false };
    }

    state.openedCount += 1;
    state.cooldownUntil = Date.now() + cooldownMs;
    state.consecutiveTrips = 0;

    this.logger.error(
      `[Circuit][${seed.city}/${seed.mode}] OPEN for ${Math.round(cooldownMs / 1000)}s (opened=${state.openedCount}). Next retry after ${new Date(state.cooldownUntil).toISOString()}`,
    );
    return { opened: true, retryAt: state.cooldownUntil };
  }

  private getChallengeRotateThresholdHits(): number {
    const raw = Number(process.env.BATDONGSAN_CHALLENGE_ROTATE_HITS || "3");
    if (!Number.isFinite(raw) || raw < 1) return 3;
    return Math.min(Math.floor(raw), 10);
  }

  private getChallengeRotateThresholdRatio(): number {
    const raw = Number(process.env.BATDONGSAN_CHALLENGE_ROTATE_RATIO || "0.3");
    if (!Number.isFinite(raw) || raw <= 0) return 0.3;
    return Math.min(Math.max(raw, 0.05), 1);
  }

  private shouldTripSeedCircuit(metrics: SeedAntiBotMetrics): boolean {
    if (metrics.navigationAttempts <= 0) return false;

    const byHits = metrics.challengeHits >= this.getChallengeRotateThresholdHits();
    const byRatio = metrics.challengeRatio >= this.getChallengeRotateThresholdRatio();
    const byStreak = this.consecutiveChallengeCount >= 3;
    return byHits || byRatio || byStreak;
  }

  private getAdaptiveDelayMs(baseMinMs: number, baseMaxMs: number): number {
    const min = Math.max(0, Math.floor(baseMinMs));
    const max = Math.max(min, Math.floor(baseMaxMs));
    const jitter = min + Math.floor(Math.random() * (max - min + 1));
    const challengePenalty = Math.min(this.consecutiveChallengeCount * 1200, 12000);
    return jitter + challengePenalty;
  }

  private getEffectiveConcurrency(): number {
    // Khi challenge nhiều thì hạ concurrency để giảm tín hiệu bất thường.
    if (this.consecutiveChallengeCount >= 2) {
      return 1;
    }
    return this.configuredConcurrency;
  }

  private trackChallenge(reason: string, url?: string): void {
    this.challengeDetectedCount += 1;
    this.consecutiveChallengeCount += 1;
    this.logger.error(
      `[AntiBot] challenge detected reason=${reason} consecutive=${this.consecutiveChallengeCount} total=${this.challengeDetectedCount}${url ? ` url=${url}` : ""
      }`,
    );
  }

  private trackSuccessSignal(): void {
    if (this.consecutiveChallengeCount > 0) {
      this.consecutiveChallengeCount = Math.max(0, this.consecutiveChallengeCount - 1);
    }
  }

  private async createBrowserContext(): Promise<BrowserContext> {
    return this.launchBrowserContext();
  }

  private async launchBrowserContext(): Promise<BrowserContext> {
    const selectedUserAgent = this.pickRandom(this.userAgents);
    await fsp.mkdir(this.userDataDir, { recursive: true });

    this.logger.log(
      `Crawler browser profile: headless=${this.getHeadlessFlag()}`,
    );

    return chromium.launchPersistentContext(this.userDataDir, {
      headless: this.getHeadlessFlag(),
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
      viewport: { width: 1366, height: 768 },
      userAgent: selectedUserAgent,
      ignoreHTTPSErrors: true,
      args: this.getBaseLaunchArgs(this.getHeadlessFlag()),
    });
  }

  private async bootstrapContext(context: BrowserContext): Promise<void> {
    await this.hardenContext(context);
    await this.ensureAuthCookies(context);
    if (this.shouldRequireLogin()) {
      await this.ensureLoggedIn(context);
    } else {
      this.logger.log("Login wait skipped. Set BATDONGSAN_REQUIRE_LOGIN=true to require an authenticated crawl.");
    }
    await this.warmUpContext(context);
  }

  private shouldRequireLogin(): boolean {
    const raw = (process.env.BATDONGSAN_REQUIRE_LOGIN || "false").toLowerCase();
    return ["1", "true", "yes"].includes(raw);
  }

  private getHeadlessFlag(): boolean {
    const raw = (process.env.BATDONGSAN_HEADLESS || "false").toLowerCase();
    return ["1", "true", "yes", "on"].includes(raw);
  }

  private getBaseLaunchArgs(headlessFlag: boolean): string[] {
    const base = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--window-size=1366,768",
      "--no-first-run",
      "--no-default-browser-check",
      "--ignore-certificate-errors",
    ];

    // Cloudflare challenge cần một số network/background behaviors mặc định của Chromium.
    if (!this.getCloudflareFriendlyMode()) {
      base.push(
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
      );
    }

    if (headlessFlag) {
      base.push("--headless=new");
    }

    return base;
  }

  private getCloudflareFriendlyMode(): boolean {
    const raw = (process.env.BATDONGSAN_CLOUDFLARE_FRIENDLY_MODE || "true").toLowerCase();
    return ["1", "true", "yes", "on"].includes(raw);
  }

  private async hardenContext(context: BrowserContext): Promise<void> {
    await context.setDefaultTimeout(60000);
    await context.setDefaultNavigationTimeout(60000);
    await context.setExtraHTTPHeaders({
      "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "upgrade-insecure-requests": "1",
      dnt: "1",
    });

    await context.addInitScript({
      content: `
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        Object.defineProperty(navigator, "platform", { get: () => "Win32" });
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
        Object.defineProperty(navigator, "language", { get: () => "vi-VN" });
        Object.defineProperty(navigator, "languages", { get: () => ["vi-VN", "vi", "en-US", "en"] });

        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters && parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      `,
    });
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private async gotoWithRetry(
    page: Page,
    url: string,
    options?: { timeout?: number; retries?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" },
  ): Promise<void> {
    const timeout = options?.timeout ?? 60000;
    const retries = options?.retries ?? 2;
    const waitUntil = options?.waitUntil ?? "domcontentloaded";

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.navigationAttemptCount += 1;
        await page.goto(url, { waitUntil, timeout });
        return;
      } catch (error: any) {
        const isLastAttempt = attempt >= retries;
        const errMsg = error?.message || String(error);
        this.logger.error(`goto attempt ${attempt + 1}/${retries + 1} failed url=${url} err=${errMsg}`);
        if (isLastAttempt) throw error;

        const backoff = 1000 * (attempt + 1) + Math.floor(Math.random() * 1500);
        await this.sleep(backoff);
      }
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
      await this.gotoWithRetry(page, this.baseUrl, { retries: 2, waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);

      const loggedIn = await this.isLoggedIn(page);
      if (loggedIn) {
        this.logger.log("✅ Already logged in (persistent profile).");
        return;
      }

      this.logger.log("⚠️ Not logged in. Please login manually in the opened browser window...");

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
        this.logger.log("Login detection uncertain, but session might still be set.");
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
    const SALE_CATS = [
      'ban-can-ho-chung-cu',
      'ban-can-ho-chung-cu-mini',
      'ban-nha-rieng',
      'ban-nha-mat-pho',
      'ban-nha-biet-thu-lien-ke',
      'ban-shophouse-nha-pho-thuong-mai',
      'ban-dat',
      'ban-dat-nen-du-an',
      'ban-trang-trai-khu-nghi-duong',
      'ban-condotel',
      'ban-kho-nha-xuong',
      'ban-loai-bat-dong-san-khac',
    ];

    const RENT_CATS = [
      'cho-thue-can-ho-chung-cu',
      'cho-thue-can-ho-chung-cu-mini',
      'cho-thue-nha-rieng',
      'cho-thue-nha-biet-thu-lien-ke',
      'cho-thue-nha-mat-pho',
      'cho-thue-shophouse-nha-pho-thuong-mai',
      'cho-thue-nha-tro-phong-tro',
      'cho-thue-van-phong',
      'cho-thue-sang-nhuong-cua-hang-ki-ot',
      'cho-thue-kho-nha-xuong-dat',
      'cho-thue-loai-bat-dong-san-khac',
    ];

    const citySlug: Record<CityKey, string> = {
      HN: 'ha-noi',
      HCM: 'tp-hcm',
    };

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
  private async crawlCategory(
    seed: CrawlSeed,
    ctx: {
      remainingBudget: number;
      maxPagesPerCategory: number;
      pw: BrowserContext;
      onDetailResult?: (result: CrawlDetailResult) => Promise<void>;
    },
  ) {
    const label = `[${seed.city}][${seed.mode}]${seed.categoryPath}`;
    this.logger.log(`Crawling category ${label}`);

    let visited = 0;
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    let emptyPagesInRow = 0;
    const challengeStart = this.challengeDetectedCount;
    const navStart = this.navigationAttemptCount;

    for (let pageNo = 1; pageNo <= ctx.maxPagesPerCategory; pageNo++) {
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

      const limit = pLimit(this.getEffectiveConcurrency());
      const settled = await Promise.allSettled(
        takeLinks.map((url) => limit(() => this.crawlPropertyDetail(url, seed.mode, ctx.pw, ctx.onDetailResult))),
      );

      let insertedInPage = 0;
      let skippedInPage = 0;
      let failedInPage = 0;

      for (const s of settled) {
        if (s.status === "fulfilled") {
          if (s.value.status === "inserted") insertedInPage++;
          else if (s.value.status === "skipped") skippedInPage++;
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

      await this.sleep(this.getAdaptiveDelayMs(2000, 4000));
    }

    const challengeHits = this.challengeDetectedCount - challengeStart;
    const navigationAttempts = this.navigationAttemptCount - navStart;
    const challengeRatio = navigationAttempts > 0 ? challengeHits / navigationAttempts : 0;

    return {
      visited,
      inserted,
      skipped,
      failed,
      metrics: {
        challengeHits,
        navigationAttempts,
        challengeRatio,
      },
    };
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
      await this.gotoWithRetry(page, listUrl, { retries: 3, waitUntil: "domcontentloaded" });

      const solved = await this.waitForManualCloudflareSolve(page, "list", listUrl);
      if (!solved) {
        this.logger.warn(`Cloudflare not solved for list url=${listUrl}. Skip this page.`);
        return [];
      }

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
    onDetailResult?: (result: CrawlDetailResult) => Promise<void>,
  ): Promise<CrawlDetailResult> {
    const fullUrl = detailUrl.startsWith("http") ? detailUrl : `${this.baseUrl}${detailUrl}`;
    const page = await pw.newPage();

    const emit = async (result: CrawlDetailResult): Promise<CrawlDetailResult> => {
      if (onDetailResult) {
        await onDetailResult(result).catch((err: any) => {
          this.logger.error(`Failed to write crawl report line for ${result.url}: ${err?.message || err}`);
        });
      }
      return result;
    };

    try {
      const html0 = await this.fetchHtmlWithPlaywright(page, fullUrl);
      if (!html0) {
        return emit({
          status: "failed",
          url: fullUrl,
          reason: "detail-fetch-failed",
          crawledAt: new Date().toISOString(),
        });
      }

      const maTin = this.extractMaTinFromHtml(html0);
      const prId = this.extractPrIdFromUrl(fullUrl);
      const sourceUid = maTin || prId;

      if (!sourceUid) {
        this.logger.error(`No sourceUid (maTin/pr) url=${fullUrl}`);
        return emit({
          status: "failed",
          url: fullUrl,
          reason: "missing-source-uid",
          crawledAt: new Date().toISOString(),
        });
      }

      const exists = await this.prisma.post.findFirst({
        where: { source: "BATDONGSAN", sourceUid, deletedAt: null },
        select: { id: true },
      });
      if (exists) {
        this.trackSuccessSignal();
        return emit({
          status: "skipped",
          url: fullUrl,
          sourceUid,
          reason: "already-exists",
          crawledAt: new Date().toISOString(),
        });
      }

      // click để hiện full phone (chỉ để description có full text, không lưu)
      await this.revealPhoneForDescription(page);

      const htmlAfter = await page.content();
      const $ = cheerio.load(htmlAfter);

      const data = this.parseDetail($, htmlAfter, fullUrl, sourceUid);

      if (!data.title || data.title.trim().length < 4) {
        this.logger.error(`Parse empty title url=${fullUrl}`);
        return emit({
          status: "failed",
          url: fullUrl,
          sourceUid,
          reason: "invalid-title",
          crawledAt: new Date().toISOString(),
        });
      }

      await this.saveToDb(data, mode);

      this.trackSuccessSignal();
      await this.sleep(this.getAdaptiveDelayMs(2000, 4000));
      return emit({
        status: "inserted",
        url: fullUrl,
        sourceUid,
        title: data.title,
        crawledAt: new Date().toISOString(),
      });
    } catch (e: any) {
      this.logger.error(`Detail failed url=${fullUrl} err=${e?.message || e}`);
      return emit({
        status: "failed",
        url: fullUrl,
        reason: e?.message || String(e),
        crawledAt: new Date().toISOString(),
      });
    } finally {
      await page.close();
    }
  }

  private async fetchHtmlWithPlaywright(page: Page, url: string): Promise<string | null> {
    try {
      await this.gotoWithRetry(page, url, { retries: 3, waitUntil: "domcontentloaded" });

      const solved = await this.waitForManualCloudflareSolve(page, "detail", url);
      if (!solved) {
        this.logger.warn(`Cloudflare not solved for detail url=${url}.`);
        return null;
      }

      // Nếu vẫn challenge => fail
      if (await this.isCloudflareChallenge(page)) {
        this.trackChallenge("still-in-challenge", url);
        this.logger.error(`Still in challenge after manual solve url=${url}`);
        return null;
      }

      // Chờ content thật xuất hiện (không dựa vào h1)
      const ok = await this.hasRealDetailContent(page);
      if (!ok) {
        this.trackChallenge("detail-not-ready", url);
        const title = await page.title().catch(() => "");
        const htmlSmall = (await page.content()).slice(0, 900).toLowerCase();
        this.logger.error(`Detail not ready url=${url} title=${title} snippet=${htmlSmall.slice(0, 200)}`);
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

    const descriptionSelectors = [
      ".re__detail-content",
      ".re__detail-content-wrapper",
      ".re__pr-description",
      '[class*="description"]',
    ];

    const descriptionHtml = this.firstNonEmptyHtml($, descriptionSelectors);
    const descriptionText = this.firstNonEmptyText($, descriptionSelectors) || "";

    const formattedDescription = descriptionHtml || formatDescription(descriptionText);

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
    const loc = await this.resolveLocationIds(data);

    const property = await this.prisma.property.create({
      data: {
        title: data.title,
        description: null,
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
        provinceId: loc.provinceId ?? null,
        districtId: loc.districtId ?? null,
        wardId: loc.wardId ?? null,
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

    await this.syncNearbyUtilitiesForProperty(property.id, data, loc);
  }

  async backfillNearbyUtilities(opts?: { limit?: number }) {
    const limit = Math.min(Math.max(Math.trunc(Number(opts?.limit) || 100), 1), 1000);
    const properties = await this.prisma.property.findMany({
      where: {
        deletedAt: null,
        lat: { not: null },
        lon: { not: null },
        propertyUtilities: {
          none: { deletedAt: null },
        },
      },
      take: limit,
      orderBy: { id: "desc" },
      select: {
        id: true,
        title: true,
        lat: true,
        lon: true,
        location: true,
        provinceId: true,
        districtId: true,
        wardId: true,
      },
    });

    const result: NearbyUtilitiesBackfillResult = {
      scanned: properties.length,
      processed: 0,
      linkedUtilities: 0,
      failed: 0,
      invalidCoordinates: 0,
      noPoiFound: 0,
      poiRequestFailed: 0,
      rateLimited: 0,
      serverTimeout: 0,
    };

    this.updateNearbyBackfillProgress(result);

    for (const property of properties) {
      try {
        const syncResult = await this.syncNearbyUtilitiesForProperty(
          property.id,
          {
            title: property.title,
            lat: property.lat === null ? undefined : Number(property.lat),
            lon: property.lon === null ? undefined : Number(property.lon),
            location: property.location ?? undefined,
          },
          {
            provinceId: property.provinceId ?? undefined,
            districtId: property.districtId ?? undefined,
            wardId: property.wardId ?? undefined,
          },
        );
        result.processed += 1;
        result.linkedUtilities += syncResult.linked;
        this.applyNearbyBackfillSyncStatus(result, syncResult);
      } catch (error: any) {
        result.failed += 1;
        this.logger.error(`[NearbyPOI] backfill failed propertyId=${property.id}: ${error?.message || error}`);
      }

      this.updateNearbyBackfillProgress(result);
    }

    return result;
  }

  startNearbyUtilitiesBackfill(opts?: { limit?: number }) {
    if (this.nearbyUtilitiesBackfillRunning) {
      return {
        started: false,
        running: true,
        message: "Nearby utilities backfill is already running",
        status: this.nearbyUtilitiesBackfillStatus,
      };
    }

    this.nearbyUtilitiesBackfillRunning = true;
    const startedAt = Date.now();
    const limit = Math.min(Math.max(Math.trunc(Number(opts?.limit) || 100), 1), 1000);
    this.nearbyUtilitiesBackfillStatus = {
      running: true,
      startedAt: new Date(startedAt).toISOString(),
      limit,
    };

    void this.backfillNearbyUtilities({ limit })
      .then((result) => {
        this.nearbyUtilitiesBackfillStatus = {
          running: false,
          startedAt: this.nearbyUtilitiesBackfillStatus.startedAt,
          finishedAt: new Date().toISOString(),
          limit,
          result,
        };
        this.logger.log(
          `[NearbyPOI] backfill completed limit=${limit} scanned=${result.scanned} processed=${result.processed} linked=${result.linkedUtilities} failed=${result.failed} tookMs=${Date.now() - startedAt}`,
        );
      })
      .catch((error: any) => {
        this.nearbyUtilitiesBackfillStatus = {
          running: false,
          startedAt: this.nearbyUtilitiesBackfillStatus.startedAt,
          finishedAt: new Date().toISOString(),
          limit,
          error: error?.message || String(error),
        };
        this.logger.error(`[NearbyPOI] backfill crashed: ${error?.message || error}`);
      })
      .finally(() => {
        this.nearbyUtilitiesBackfillRunning = false;
      });

    return {
      started: true,
      running: true,
      limit,
      message: "Nearby utilities backfill started",
    };
  }

  getNearbyUtilitiesBackfillStatus() {
    return this.nearbyUtilitiesBackfillStatus;
  }

  private updateNearbyBackfillProgress(
    result: NearbyUtilitiesBackfillResult,
  ) {
    if (!this.nearbyUtilitiesBackfillStatus.running) return;
    this.nearbyUtilitiesBackfillStatus = {
      ...this.nearbyUtilitiesBackfillStatus,
      result: { ...result },
    };
  }

  private applyNearbyBackfillSyncStatus(
    result: NearbyUtilitiesBackfillResult,
    syncResult: NearbyPoiSyncResult,
  ) {
    switch (syncResult.status) {
      case "invalid_coordinates":
        result.invalidCoordinates += 1;
        break;
      case "no_poi":
        result.noPoiFound += 1;
        break;
      case "rate_limited":
        result.rateLimited += 1;
        result.poiRequestFailed += 1;
        break;
      case "server_timeout":
        result.serverTimeout += 1;
        result.poiRequestFailed += 1;
        break;
      case "request_failed":
        result.poiRequestFailed += 1;
        break;
      default:
        break;
    }
  }

  private isNearbyPoiEnabled(): boolean {
    return (process.env.BATDONGSAN_NEARBY_POI_ENABLED || "true").toLowerCase() !== "false";
  }

  private getNearbyPoiRadiusM(): number {
    return NEARBY_POI_RADIUS_M;
  }

  private getNearbyPoiPerCategoryLimit(): number {
    return NEARBY_POI_PER_CATEGORY_LIMIT;
  }

  private getOverpassEndpoint(): string {
    return OVERPASS_API_URL;
  }

  private getOverpassTimeoutMs(): number {
    const raw = Number(process.env.OVERPASS_TIMEOUT_MS || "12000");
    if (!Number.isFinite(raw) || raw <= 0) return 12000;
    return Math.min(Math.max(Math.trunc(raw), 3000), 60000);
  }

  private getOverpassMinIntervalMs(): number {
    const raw = Number(process.env.OVERPASS_MIN_INTERVAL_MS || "1200");
    if (!Number.isFinite(raw) || raw < 0) return 1200;
    return Math.min(Math.trunc(raw), 10000);
  }

  private async syncNearbyUtilitiesForProperty(
    propertyId: number,
    data: Pick<CrawledProperty, "title" | "lat" | "lon" | "location">,
    loc?: LocationMatch,
  ): Promise<NearbyPoiSyncResult> {
    if (!this.isNearbyPoiEnabled()) return { status: "disabled", linked: 0 };

    const lat = Number(data.lat);
    const lon = Number(data.lon);
    if (!this.isValidVietnamCoordinate(lat, lon)) {
      this.logger.warn(`[NearbyPOI] invalid coordinates propertyId=${propertyId} lat=${data.lat} lon=${data.lon}`);
      return { status: "invalid_coordinates", linked: 0 };
    }

    const fetchResult = await this.fetchNearbyPoisFromOverpass(lat, lon);
    if (!fetchResult.pois.length) {
      return {
        status: fetchResult.status,
        linked: 0,
        httpStatus: fetchResult.httpStatus,
        message: fetchResult.message,
      };
    }

    let linked = 0;
    for (const poi of fetchResult.pois) {
      const utility = await this.findOrCreateUtility(poi, loc);
      await this.prisma.propertyUtility.upsert({
        where: {
          propertyId_utilityId: {
            propertyId,
            utilityId: utility.id,
          },
        },
        create: {
          propertyId,
          utilityId: utility.id,
          distanceM: poi.distanceM,
          travelTimeS: poi.travelTimeS,
          isPrimary: false,
          note: "OSM Overpass; distance is straight-line and travel time is estimated.",
        },
        update: {
          distanceM: poi.distanceM,
          travelTimeS: poi.travelTimeS,
          deletedAt: null,
          note: "OSM Overpass; distance is straight-line and travel time is estimated.",
        },
      });
      linked += 1;
    }

    this.logger.log(`[NearbyPOI] propertyId=${propertyId} linked=${linked}`);
    return { status: "ok", linked };
  }

  private isValidVietnamCoordinate(lat: number, lon: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (lat === 0 && lon === 0) return false;
    return lat >= 8 && lat <= 24 && lon >= 102 && lon <= 110;
  }

  private async findOrCreateUtility(poi: NearbyPoi, loc?: LocationMatch): Promise<{ id: number }> {
    const existing = await this.prisma.utility.findFirst({
      where: {
        deletedAt: null,
        utilityCategory: poi.category,
        utilityName: poi.name,
        lat: { gte: poi.lat - 0.00002, lte: poi.lat + 0.00002 },
        lon: { gte: poi.lon - 0.00002, lte: poi.lon + 0.00002 },
      },
      select: { id: true },
    });

    if (existing) return existing;

    return this.prisma.utility.create({
      data: {
        utilityCategory: poi.category,
        utilityName: poi.name,
        lat: poi.lat,
        lon: poi.lon,
        location: poi.location,
        provinceId: loc?.provinceId ?? null,
        districtId: loc?.districtId ?? null,
        wardId: loc?.wardId ?? null,
      },
      select: { id: true },
    });
  }

  private async fetchNearbyPoisFromOverpass(lat: number, lon: number): Promise<NearbyPoiFetchResult> {
    const radius = this.getNearbyPoiRadiusM();
    const query = this.buildOverpassNearbyQuery(lat, lon, radius);
    const endpoint = this.getOverpassEndpoint();
    const timeoutMs = this.getOverpassTimeoutMs();

    try {
      const response = await this.enqueueOverpassRequest(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "User-Agent": "real-estate-scheduler/1.0 contact=local-dev",
            },
            body: new URLSearchParams({ data: query }).toString(),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 180);
        this.logger.warn(`[NearbyPOI] Overpass failed status=${response.status} body=${body}`);

        if (response.status === 429) {
          this.setOverpassCooldown("rate limit", OVERPASS_RATE_LIMIT_COOLDOWN_MS);
          return {
            status: "rate_limited",
            pois: [],
            httpStatus: response.status,
            message: body,
          };
        }

        if (response.status === 504) {
          this.setOverpassCooldown("server timeout", OVERPASS_SERVER_TIMEOUT_COOLDOWN_MS);
          return {
            status: "server_timeout",
            pois: [],
            httpStatus: response.status,
            message: body,
          };
        }

        return {
          status: "request_failed",
          pois: [],
          httpStatus: response.status,
          message: body,
        };
      }

      const json = (await response.json()) as OverpassResponse;
      const pois = this.normalizeOverpassPois(json, lat, lon);
      return {
        status: pois.length ? "ok" : "no_poi",
        pois,
      };
    } catch (error: any) {
      this.logger.warn(`[NearbyPOI] Overpass request failed: ${error?.message || error}`);
      const message = error?.message || String(error);
      if (this.isAbortError(error)) {
        this.setOverpassCooldown("request abort", OVERPASS_ABORT_COOLDOWN_MS);
        return {
          status: "server_timeout",
          pois: [],
          message,
        };
      }

      return {
        status: "request_failed",
        pois: [],
        message,
      };
    }
  }

  private async enqueueOverpassRequest<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.overpassQueue.then(async () => {
      const cooldownWaitMs = Math.max(0, this.overpassCooldownUntil - Date.now());
      if (cooldownWaitMs > 0) await this.sleep(cooldownWaitMs);
      const waitMs = Math.max(0, this.getOverpassMinIntervalMs() - (Date.now() - this.lastOverpassRequestAt));
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastOverpassRequestAt = Date.now();
      return fn();
    });

    this.overpassQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private setOverpassCooldown(reason: string, durationMs: number) {
    const until = Date.now() + durationMs;
    if (until <= this.overpassCooldownUntil) return;
    this.overpassCooldownUntil = until;
    this.logger.warn(`[NearbyPOI] Overpass cooldown reason=${reason} durationMs=${durationMs}`);
  }

  private isAbortError(error: any): boolean {
    const message = String(error?.message || error || "").toLowerCase();
    return error?.name === "AbortError" || message.includes("aborted");
  }

  private buildOverpassNearbyQuery(lat: number, lon: number, radius: number): string {
    return `
      [out:json][timeout:25];
      (
        nwr["amenity"~"school|kindergarten|university|college|hospital|clinic|doctors|dentist|pharmacy|restaurant|cafe|fast_food|food_court|marketplace"](around:${radius},${lat},${lon});
        nwr["shop"~"supermarket|convenience|mall|department_store"](around:${radius},${lat},${lon});
        nwr["leisure"~"park|garden|playground"](around:${radius},${lat},${lon});
        nwr["landuse"="recreation_ground"](around:${radius},${lat},${lon});
      );
      out center tags 120;
    `.trim();
  }

  private normalizeOverpassPois(response: OverpassResponse, propertyLat: number, propertyLon: number): NearbyPoi[] {
    const perCategoryLimit = this.getNearbyPoiPerCategoryLimit();
    const seen = new Set<string>();
    const items: NearbyPoi[] = [];

    for (const element of response.elements ?? []) {
      const tags = element.tags ?? {};
      const category = this.mapOverpassCategory(tags);
      if (!category) continue;

      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const name = this.getOverpassPoiName(tags);
      if (!name) continue;

      const key = `${category}|${name.toLowerCase()}|${Number(lat).toFixed(5)}|${Number(lon).toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const distanceM = Math.round(this.haversineDistanceM(propertyLat, propertyLon, Number(lat), Number(lon)));
      items.push({
        overpassId: `${element.type}/${element.id}`,
        name,
        category,
        lat: Number(lat),
        lon: Number(lon),
        location: this.formatOverpassAddress(tags),
        distanceM,
        travelTimeS: this.estimateCityTravelTimeS(distanceM),
      });
    }

    const buckets = new Map<UtilityCategory, NearbyPoi[]>();
    for (const item of items) {
      const bucket = buckets.get(item.category) ?? [];
      bucket.push(item);
      buckets.set(item.category, bucket);
    }

    return Array.from(buckets.values()).flatMap((bucket) =>
      bucket.sort((a, b) => a.distanceM - b.distanceM).slice(0, perCategoryLimit),
    );
  }

  private mapOverpassCategory(tags: Record<string, string>): UtilityCategory | null {
    const amenity = tags.amenity;
    const shop = tags.shop;
    const leisure = tags.leisure;
    const landuse = tags.landuse;

    if (["school", "kindergarten", "university", "college"].includes(amenity)) return UtilityCategory.EDUCATION;
    if (["hospital", "clinic", "doctors", "dentist", "pharmacy"].includes(amenity)) return UtilityCategory.HEALTHCARE;
    if (["restaurant", "cafe", "fast_food", "food_court"].includes(amenity)) return UtilityCategory.DINING;
    if (amenity === "marketplace" || ["supermarket", "convenience", "mall", "department_store"].includes(shop)) {
      return UtilityCategory.COMMERCIAL_SHOPPING;
    }
    if (["park", "garden", "playground"].includes(leisure) || landuse === "recreation_ground") {
      return UtilityCategory.PARK_PLAZA;
    }

    return null;
  }

  private getOverpassPoiName(tags: Record<string, string>): string | null {
    const raw = tags["name:vi"] || tags.name || tags.brand || tags.operator;
    const name = (raw || "").replace(/\s+/g, " ").trim();
    return name.length >= 2 ? name.slice(0, 180) : null;
  }

  private formatOverpassAddress(tags: Record<string, string>): string | null {
    const house = tags["addr:housenumber"];
    const street = tags["addr:street"];
    const ward = tags["addr:ward"] || tags["addr:suburb"];
    const district = tags["addr:district"];
    const city = tags["addr:city"] || tags["addr:province"];
    const fallback = tags["addr:full"];
    const parts = [house, street, ward, district, city].filter((part) => !!part && String(part).trim());
    const text = parts.length ? parts.join(", ") : fallback;
    return text ? text.replace(/\s+/g, " ").trim().slice(0, 255) : null;
  }

  private haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusM = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private estimateCityTravelTimeS(distanceM: number): number {
    const metersPerSecond = 30000 / 3600;
    return Math.max(0, Math.round(distanceM / metersPerSecond));
  }

  // ---------------------------
  // Auth via COOKIES (cookie name fixed)
  // ---------------------------
  private async ensureAuthCookies(pw: BrowserContext) {
    const access = this.accessToken;
    const refresh = this.refreshToken;

    if (!access && !refresh) {
      this.logger.log("No BATDONGSAN_ACCESS_TOKEN / BATDONGSAN_REFRESH_TOKEN in env. Skip cookie auth.");
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
      await this.gotoWithRetry(page, this.baseUrl, { retries: 2, waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      this.logger.log(`Auth cookies injected: access=${access ? "yes" : "no"} refresh=${refresh ? "yes" : "no"}`);
    } catch (e: any) {
      this.logger.log(`ensureAuthCookies failed: ${e?.message || e}`);
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

  private firstNonEmptyHtml($: cheerio.CheerioAPI, selectors: string[]): string | null {
    for (const sel of selectors) {
      const node = $(sel).first();
      if (!node.length) continue;

      const rawHtml = (node.html() || "").trim();
      const text = node.text().replace(/\s+/g, " ").trim();
      if (!rawHtml || !text) continue;

      const sanitized = this.sanitizeDescriptionHtml(rawHtml);
      if (sanitized && this.htmlToText(sanitized)) return sanitized;
    }

    return null;
  }

  private sanitizeDescriptionHtml(rawHtml: string): string {
    const allowedTags = new Set([
      "a",
      "b",
      "blockquote",
      "br",
      "em",
      "h2",
      "h3",
      "h4",
      "i",
      "li",
      "ol",
      "p",
      "strong",
      "u",
      "ul",
    ]);
    const dangerousTags = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "noscript"]);
    const fragment = cheerio.load(`<div data-crawl-description-root>${rawHtml}</div>`, undefined, false);
    const root = fragment("[data-crawl-description-root]");

    root.find("*").each((_, el) => {
      const tagName = (el as any).tagName?.toLowerCase();
      const node = fragment(el);

      if (!tagName) return;

      if (dangerousTags.has(tagName)) {
        node.remove();
        return;
      }

      if (!allowedTags.has(tagName)) {
        node.replaceWith(node.contents());
        return;
      }

      const href = tagName === "a" ? String((el as any).attribs?.href || "").trim() : "";

      for (const attr of Object.keys((el as any).attribs || {})) {
        node.removeAttr(attr);
      }

      if (tagName === "a") {
        if (/^(https?:|mailto:|tel:|\/)/i.test(href)) {
          node.attr("href", href);
          node.attr("target", "_blank");
          node.attr("rel", "noopener noreferrer");
        }
      }
    });

    return (root.html() || "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private htmlToText(html: string): string {
    return cheerio.load(html).text().replace(/\s+/g, " ").trim();
  }

  private async resolveLocationIds(data: CrawledProperty): Promise<LocationMatch> {
    const primaryText = [data.location, data.title].filter(Boolean).join(" ");
    return this.matchLocationText(primaryText);
  }

  private async matchLocationText(input: string): Promise<LocationMatch> {
    const cache = await this.getLocationCache();
    const text = this.normalizeLocationText(input);
    if (!text) return {};

    let province = this.findBestLocationCandidate(text, cache.provinces, "province");
    const districtPool = province ? province.districts : cache.districts;
    let district = this.findBestLocationCandidate(text, districtPool, "district");
    const wardPool = district ? district.wards : province ? province.districts.flatMap((d) => d.wards) : cache.wards;
    const ward = this.findBestLocationCandidate(text, wardPool, "ward");

    if (ward && !district) {
      district = ward.district;
    }

    if (district && !province) {
      province = district.province;
    }

    return {
      provinceId: province?.id,
      districtId: district?.id,
      wardId: ward?.id,
    };
  }

  private async getLocationCache(): Promise<LocationCache> {
    if (this.locationCache) return this.locationCache;

    const provinces = await this.prisma.province.findMany({
      select: {
        id: true,
        name: true,
        districts: {
          select: {
            id: true,
            name: true,
            provinceId: true,
            wards: {
              select: {
                id: true,
                name: true,
                districtId: true,
              },
            },
          },
        },
      },
    });

    const normalizedProvinces: LocationProvince[] = provinces.map((province) => {
      const p: LocationProvince = {
        id: province.id,
        name: province.name,
        districts: [],
        norm: this.normalizeLocationText(province.name),
        bare: this.normalizeLocationName(province.name, "province"),
      };

      p.districts = province.districts.map((district) => {
        const d: LocationDistrict = {
          id: district.id,
          name: district.name,
          provinceId: district.provinceId,
          province: p,
          wards: [],
          norm: this.normalizeLocationText(district.name),
          bare: this.normalizeLocationName(district.name, "district"),
        };

        d.wards = district.wards.map((ward) => ({
          id: ward.id,
          name: ward.name,
          districtId: ward.districtId,
          district: d,
          norm: this.normalizeLocationText(ward.name),
          bare: this.normalizeLocationName(ward.name, "ward"),
        }));

        return d;
      });

      return p;
    });

    this.locationCache = {
      provinces: normalizedProvinces,
      districts: normalizedProvinces.flatMap((p) => p.districts),
      wards: normalizedProvinces.flatMap((p) => p.districts).flatMap((d) => d.wards),
    };

    return this.locationCache;
  }

  private findBestLocationCandidate<T extends { name: string; norm: string; bare: string }>(
    text: string,
    candidates: T[],
    level: "province" | "district" | "ward",
  ): T | undefined {
    let best: { item: T; score: number } | undefined;

    for (const item of candidates) {
      const variants = this.locationNameVariants(item, level);
      for (const variant of variants) {
        const index = this.indexOfLocationPhrase(text, variant.value);
        if (index < 0) continue;

        const score = index + variant.penalty - variant.value.length / 1000;
        if (!best || score < best.score) {
          best = { item, score };
        }
      }
    }

    return best?.item;
  }

  private locationNameVariants(
    item: { name: string; norm: string; bare: string },
    level: "province" | "district" | "ward",
  ): Array<{ value: string; penalty: number }> {
    const variants = new Map<string, number>();
    const add = (value: string, penalty: number) => {
      const v = this.normalizeLocationText(value);
      if (!v) return;
      const existing = variants.get(v);
      if (existing == null || penalty < existing) variants.set(v, penalty);
    };

    add(item.norm, 0);
    const bareIsNumeric = /^\d+[a-z]?$/.test(item.bare);
    if (!bareIsNumeric) {
      add(item.bare, 12);
    }

    if (level === "ward") {
      add(`phuong ${item.bare}`, 0);
      add(`xa ${item.bare}`, 0);
      add(`thi tran ${item.bare}`, 0);
    } else if (level === "district") {
      add(`quan ${item.bare}`, 0);
      add(`huyen ${item.bare}`, 0);
      add(`thi xa ${item.bare}`, 0);
      add(`thanh pho ${item.bare}`, 0);
    } else {
      add(`tinh ${item.bare}`, 0);
      add(`thanh pho ${item.bare}`, 0);
      if (item.bare === "ho chi minh") {
        add("hcm", 0);
        add("tp hcm", 0);
        add("tphcm", 0);
        add("sai gon", 4);
      }
    }

    return Array.from(variants, ([value, penalty]) => ({ value, penalty }));
  }

  private indexOfLocationPhrase(text: string, phrase: string): number {
    const p = this.normalizeLocationText(phrase);
    if (!p) return -1;
    return ` ${text} `.indexOf(` ${p} `);
  }

  private normalizeLocationName(name: string, level: "province" | "district" | "ward"): string {
    const prefixes =
      level === "ward"
        ? ["phuong", "xa", "thi tran"]
        : level === "district"
          ? ["quan", "huyen", "thi xa", "thanh pho", "tp"]
          : ["tinh", "thanh pho", "tp"];

    let out = this.normalizeLocationText(name);
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of prefixes) {
        if (out === prefix) continue;
        if (out.startsWith(`${prefix} `)) {
          out = out.slice(prefix.length + 1).trim();
          changed = true;
        }
      }
    }
    return out;
  }

  private normalizeLocationText(value?: string | null): string {
    return (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
      await this.gotoWithRetry(page, this.baseUrl, { retries: 2, waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2200);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(900);
    } catch (e: any) {
      this.logger.error(`warmUp failed: ${e?.message || e}`);
    } finally {
      await page.close();
    }
  }

  private async isCloudflareChallenge(page: Page): Promise<boolean> {
    const url = page.url() || "";
    if (url.includes("/cdn-cgi/")) return true;

    const title = ((await page.title().catch(() => "")) || "").toLowerCase();
    if (
      title.includes("just a moment") ||
      title.includes("attention required") ||
      title.includes("captcha")
    ) return true;

    // Các dấu hiệu CF challenge / Turnstile hay gặp
    const sel =
      'form#challenge-form,' +
      '[id*="cf-chl"],' +
      '[class*="cf-chl"],' +
      'iframe[src*="turnstile"],' +
      'input[name="cf-turnstile-response"],' +
      '[data-sitekey],' +
      '[class*="challenge-platform"]';

    const count = await page.locator(sel).count().catch(() => 0);
    return count > 0;
  }

  private async waitForManualCloudflareSolve(
    page: Page,
    expected: "list" | "detail",
    urlForLog: string,
    timeoutMs = 15 * 60 * 1000,
  ): Promise<boolean> {
    const start = Date.now();

    // Nếu chưa challenge thì vẫn phải chắc chắn trang thật đã có content mong đợi
    const isExpectedReady = async () => {
      if (await this.isCloudflareChallenge(page)) return false;
      if (expected === "detail") return this.hasRealDetailContent(page);
      return this.hasRealListContent(page);
    };

    if (await isExpectedReady()) {
      this.trackSuccessSignal();
      return true;
    }

    this.trackChallenge("challenge-or-not-ready", urlForLog);

    this.logger.log(`⚠️ Cloudflare/challenge or not-ready detected. Solve manually.\nurl=${urlForLog}`);
    await page.bringToFront().catch(() => null);

    while (Date.now() - start < timeoutMs) {
      // Chờ người dùng click/solve + redirect xong
      await page.waitForTimeout(800);

      // Chờ load ổn định (nếu có navigation)
      await page.waitForLoadState("domcontentloaded").catch(() => null);

      // Nếu đã có cookie clearance thì tốt
      await this.waitForClearanceCookie(page.context(), 10_000).catch(() => null);

      // Sau solve thường redirect, nên check lại điều kiện thật kỹ
      if (await isExpectedReady()) {
        // đợi thêm chút để tránh vừa xong lại bị re-challenge ngay lập tức
        await page.waitForTimeout(1200);
        // check lần nữa cho chắc
        if (await isExpectedReady()) {
          this.trackSuccessSignal();
          return true;
        }
      }
    }

    this.trackChallenge("manual-solve-timeout", urlForLog);
    this.logger.warn(`Manual Cloudflare solve timeout after ${timeoutMs}ms url=${urlForLog}`);
    return false;
  }

  private async hasRealListContent(page: Page): Promise<boolean> {
    // list thật của bds thường có link -prxxxx; challenge page thì không
    const linkCount = await page.locator('a[href*="-pr"]').count().catch(() => 0);
    if (linkCount > 0) return true;

    // fallback nhẹ: đôi khi DOM khác nhưng vẫn có nhiều <a href="https://batdongsan.com.vn/...">
    const bdsLinkCount = await page.locator('a[href^="https://batdongsan.com.vn/"]').count().catch(() => 0);
    return bdsLinkCount > 10;
  }

  private async hasRealDetailContent(page: Page): Promise<boolean> {
    // IMPORTANT: đừng dùng h1 vì CF challenge cũng có h1
    const contentCount = await page
      .locator(".re__detail-content, .re__detail-content-wrapper, .re__pr-description")
      .count()
      .catch(() => 0);

    const title = ((await page.title().catch(() => "")) || "").toLowerCase();
    if (title.includes("just a moment") || title.includes("attention required") || title.includes("captcha")) return false;

    return contentCount > 0;
  }

  private async waitForClearanceCookie(
    ctx: BrowserContext,
    timeoutMs = 60_000,
  ): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const cookies: Cookie[] = await ctx.cookies().catch(() => [] as Cookie[]);
      const hasClearance = cookies.some((c) => c.name === "cf_clearance");
      if (hasClearance) return true;
      await new Promise((r) => setTimeout(r, 500));
    }

    return false;
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
}
