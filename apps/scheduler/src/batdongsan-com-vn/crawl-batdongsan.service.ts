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

chromium.use(StealthPlugin());

const WEBSHARE_DEFAULT_HOST = "proxy.webshare.io";

type WebshareProxy = {
  id: string;
  username: string;
  password: string;
  proxy_address: string | null;
  port: number;
  valid: boolean;
};

type WebshareProxyListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebshareProxy[];
};

type LaunchProxyConfig = {
  server: string;
  username?: string;
  password?: string;
};

type LocationWard = {
  id: number;
  name: string;
  districtId: number;
  district?: LocationDistrict;
  norm: string;
  bare: string;
};

type LocationDistrict = {
  id: number;
  name: string;
  provinceId: number;
  province?: LocationProvince;
  wards: LocationWard[];
  norm: string;
  bare: string;
};

type LocationProvince = {
  id: number;
  name: string;
  districts: LocationDistrict[];
  norm: string;
  bare: string;
};

type LocationCache = {
  provinces: LocationProvince[];
  districts: LocationDistrict[];
  wards: LocationWard[];
};

type LocationMatch = {
  provinceId?: number;
  districtId?: number;
  wardId?: number;
};

type SeedAntiBotMetrics = {
  challengeHits: number;
  navigationAttempts: number;
  challengeRatio: number;
  proxyRotated: boolean;
};

type SeedCircuitState = {
  consecutiveTrips: number;
  cooldownUntil: number;
  openedCount: number;
  lastReason?: string;
};

type CrawlDetailStatus = "inserted" | "skipped" | "failed";

type CrawlDetailResult = {
  status: CrawlDetailStatus;
  url: string;
  sourceUid?: string;
  title?: string;
  reason?: string;
  crawledAt: string;
};

type CrawlRunReport = {
  startedAt: string;
  finishedAt?: string;
  reportVersion: string;
  filters: {
    cities: CityKey[];
    modes: ModeKey[];
  };
  summary: {
    visited: number;
    inserted: number;
    skipped: number;
    failed: number;
    seedsCircuitSkipped: number;
    challengeDetected: number;
    challengeRatio: number;
    proxyRotations: number;
    tookMs: number;
  };
  insertedItems: CrawlDetailResult[];
  skippedItems: CrawlDetailResult[];
  failedItems: CrawlDetailResult[];
  files: {
    json?: string;
    jsonl?: string;
  };
};

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
  private readonly webshareApiKey = process.env.WEBSHARE_API_KEY || "";
  private webshareProxies: WebshareProxy[] = [];
  private webshareProxyIndex = 0;
  private webshareProxyLastFetch = 0;
  private readonly webshareProxyCacheTtlMs = 5 * 60 * 1000;
  private runtimeProxyDisabled = false;

  private readonly userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  ];

  private navigationAttemptCount = 0;
  private challengeDetectedCount = 0;
  private consecutiveChallengeCount = 0;
  private proxyRotationCount = 0;
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
        proxyRotations: 0,
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

        let seedProxyRotated = false;
        const maxSeedRecoveries = this.getSeedMaxRecoveries();
        let recoveryAttempt = 0;
        let r: { visited: number; inserted: number; skipped: number; failed: number; metrics: SeedAntiBotMetrics } | null =
          null;

        while (recoveryAttempt <= maxSeedRecoveries) {
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

          const shouldRotate = this.shouldRotateProxyForSeed(r.metrics);
          if (!shouldRotate || recoveryAttempt >= maxSeedRecoveries) {
            break;
          }

          seedProxyRotated = true;
          recoveryAttempt += 1;
          this.logger.error(
            `[AntiBot][${seed.city}/${seed.mode}] challengeRatio=${(r.metrics.challengeRatio * 100).toFixed(1)}% challengeHits=${r.metrics.challengeHits}. Rotate proxy and retry seed (${recoveryAttempt}/${maxSeedRecoveries})`,
          );

          pw = await this.rotateBrowserContext(pw, "seed challenge threshold reached");
          await this.bootstrapContext(pw);
        }

        if (!r) {
          continue;
        }

        const stillUnstableAfterRetries = this.shouldRotateProxyForSeed(r.metrics);
        if (stillUnstableAfterRetries) {
          const breaker = this.markSeedTrip(seed, "high challenge persisted after recoveries", r.metrics);
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
          ).toFixed(1)}% rotated=${seedProxyRotated}`,
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
      ).toFixed(1)}% proxyRotations=${this.proxyRotationCount} consecutiveChallenge=${this.consecutiveChallengeCount} seedsCircuitSkipped=${totalSeedsSkippedByCircuit}`,
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
      proxyRotations: this.proxyRotationCount,
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

  private getSeedMaxRecoveries(): number {
    const raw = Number(process.env.BATDONGSAN_SEED_MAX_RECOVERIES || "2");
    if (!Number.isFinite(raw) || raw < 0) return 2;
    return Math.min(Math.floor(raw), 5);
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

  private shouldRotateProxyForSeed(metrics: SeedAntiBotMetrics): boolean {
    if (!this.isProxyEnabled()) return false;
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

  private getProfileDirForProxy(proxy?: LaunchProxyConfig): string {
    if (!proxy?.server) {
      return this.userDataDir;
    }

    const raw = `${proxy.server}-${proxy.username || "anon"}`;
    const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    return path.join(this.userDataDir, safe || "default");
  }

  private async createBrowserContext(): Promise<BrowserContext> {
    const proxy = this.isProxyEnabled() ? await this.getNextWebshareProxy() : undefined;
    const context = await this.launchBrowserContext(proxy);

    if (!proxy || !this.getProxyHealthCheckEnabled()) {
      return context;
    }

    const healthy = await this.verifyContextConnectivity(context, this.getNavigationProbeTimeoutMs());
    if (healthy) {
      return context;
    }

    this.logger.error(
      "[Proxy] Proxy context failed connectivity probe. Disable proxy for current process and fallback to direct connection.",
    );
    this.runtimeProxyDisabled = true;
    await context.close().catch(() => null);
    return this.launchBrowserContext(undefined);
  }

  private async launchBrowserContext(proxy?: LaunchProxyConfig): Promise<BrowserContext> {
    const selectedUserAgent = this.pickRandom(this.userAgents);
    const profileDir = this.getProfileDirForProxy(proxy);
    await fsp.mkdir(profileDir, { recursive: true });

    this.logger.log(
      `Crawler browser profile: headless=${this.getHeadlessFlag()} proxy=${proxy?.server ? `enabled(${proxy.server})` : "disabled"}`,
    );

    return chromium.launchPersistentContext(profileDir, {
      headless: this.getHeadlessFlag(),
      locale: "vi-VN",
      timezoneId: "Asia/Ho_Chi_Minh",
      viewport: { width: 1366, height: 768 },
      userAgent: selectedUserAgent,
      ignoreHTTPSErrors: true,
      proxy,
      args: this.getBaseLaunchArgs(this.getHeadlessFlag()),
    });
  }

  private getNavigationProbeTimeoutMs(): number {
    const raw = Number(process.env.BATDONGSAN_NAV_PROBE_TIMEOUT_MS || "20000");
    if (!Number.isFinite(raw) || raw < 3000) return 20000;
    return Math.min(Math.floor(raw), 120000);
  }

  private getProxyHealthCheckEnabled(): boolean {
    const raw = (process.env.BATDONGSAN_PROXY_HEALTHCHECK || "true").toLowerCase();
    return ["1", "true", "yes", "on"].includes(raw);
  }

  private isNetworkNavigationError(error: any): boolean {
    const msg = String(error?.message || error || "").toLowerCase();
    return (
      msg.includes("err_timed_out") ||
      msg.includes("err_aborted") ||
      msg.includes("err_proxy_connection_failed") ||
      msg.includes("err_tunnel_connection_failed") ||
      msg.includes("err_connection_refused") ||
      msg.includes("err_name_not_resolved")
    );
  }

  private async verifyContextConnectivity(context: BrowserContext, timeoutMs: number): Promise<boolean> {
    const page = await context.newPage();
    try {
      this.navigationAttemptCount += 1;
      await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      return true;
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      this.logger.error(`[Probe] context connectivity failed err=${errMsg}`);
      return !this.isNetworkNavigationError(error);
    } finally {
      await page.close().catch(() => null);
    }
  }

  private async rotateBrowserContext(current: BrowserContext | null, reason: string): Promise<BrowserContext> {
    if (current) {
      await current.close().catch(() => null);
    }
    this.proxyRotationCount += 1;
    this.logger.error(`[AntiBot] rotating browser context (${this.proxyRotationCount}) reason=${reason}`);
    return this.createBrowserContext();
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

  private isProxyEnabled(): boolean {
    if (this.runtimeProxyDisabled) return false;
    const enabled = (process.env.BATDONGSAN_PROXY_ENABLED || process.env.WEBSHARE_PROXY_ENABLED || "false").toLowerCase();
    return ["1", "true", "yes", "on"].includes(enabled);
  }

  private async fetchWebshareProxies(): Promise<WebshareProxy[]> {
    if (!this.isProxyEnabled()) return [];
    if (!this.webshareApiKey) {
      this.logger.error("Proxy is enabled but WEBSHARE_API_KEY is missing.");
      return [];
    }

    const now = Date.now();
    if (this.webshareProxies.length > 0 && now - this.webshareProxyLastFetch < this.webshareProxyCacheTtlMs) {
      return this.webshareProxies;
    }

    try {
      const response = await fetch("https://proxy.webshare.io/api/v2/proxy/list/?mode=backbone&page_size=100", {
        headers: {
          Authorization: `Token ${this.webshareApiKey}`,
        },
      });

      if (!response.ok) {
        this.logger.error(`Unable to fetch Webshare proxies: ${response.status} ${response.statusText}`);
        return this.webshareProxies;
      }

      const data = (await response.json()) as WebshareProxyListResponse;
      const candidates =
        data.results?.map((proxy) => ({
          ...proxy,
          proxy_address: proxy.proxy_address || WEBSHARE_DEFAULT_HOST,
        })) ?? [];
      const valid = candidates.filter((proxy) => proxy.valid !== false && !!proxy.username && !!proxy.password);

      if (valid.length > 0) {
        this.webshareProxies = valid;
        this.webshareProxyLastFetch = now;
        this.webshareProxyIndex = Math.floor(Math.random() * valid.length);
        this.logger.log(`Fetched ${valid.length} valid Webshare proxies`);
      } else {
        this.logger.error("Webshare returned no valid proxies.");
      }

      return this.webshareProxies;
    } catch (error: any) {
      this.logger.error(`fetchWebshareProxies failed: ${error?.message || error}`);
      return this.webshareProxies;
    }
  }

  private async getNextWebshareProxy(): Promise<LaunchProxyConfig | undefined> {
    const proxies = await this.fetchWebshareProxies();
    if (proxies.length === 0) return undefined;

    const proxy = proxies[this.webshareProxyIndex % proxies.length];
    this.webshareProxyIndex = (this.webshareProxyIndex + 1) % proxies.length;

    // Webshare endpoint ổn định cho rotating proxy pool
    return {
      server: "http://p.webshare.io:80",
      username: proxy.username,
      password: proxy.password,
    };
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
        proxyRotated: false,
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
    add(item.bare, 12);

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
