import { UtilityCategory } from "@prisma/client";

export type CityKey = 'HN' | 'HCM';
export type ModeKey = 'SALE' | 'RENT';

export interface CrawledProperty {
  title: string;

  price?: number;
  area?: number;
  location?: string;
  description?: string;

  bedroomNumber?: number;
  toiletNumber?: number;
  floorNumber?: number;
  frontage?: number;
  roadWidth?: number;

  furnitureStatus?: 'UNFURNISHED' | 'PARTLY_FURNISHED' | 'FULLY_FURNISHED';
  legalStatus?: 'FREEHOLD' | 'LEASEHOLD' | 'RED_BOOK' | 'PINK_BOOK' | 'SALE_CONTRACT' | 'OTHER';
  orientation?: string;

  lat?: number;
  lon?: number;

  propertyType?: string;
  images?: string[];
  contactInfo?: string;

  // source
  sourceUrl: string;
  sourceUid: string;
  rawPriceText?: string;
  rawAreaText?: string;
}

export interface CrawlSeed {
  city: CityKey;
  mode: ModeKey;
  categoryPath: string;
}

export type LocationWard = {
  id: number;
  name: string;
  districtId: number;
  district?: LocationDistrict;
  norm: string;
  bare: string;
};

export type LocationDistrict = {
  id: number;
  name: string;
  provinceId: number;
  province?: LocationProvince;
  wards: LocationWard[];
  norm: string;
  bare: string;
};

export type LocationProvince = {
  id: number;
  name: string;
  districts: LocationDistrict[];
  norm: string;
  bare: string;
};

export type LocationCache = {
  provinces: LocationProvince[];
  districts: LocationDistrict[];
  wards: LocationWard[];
};

export type LocationMatch = {
  provinceId?: number;
  districtId?: number;
  wardId?: number;
};

export type SeedAntiBotMetrics = {
  challengeHits: number;
  navigationAttempts: number;
  challengeRatio: number;
};

export type SeedCircuitState = {
  consecutiveTrips: number;
  cooldownUntil: number;
  openedCount: number;
  lastReason?: string;
};

export type CrawlDetailStatus = "inserted" | "skipped" | "failed";

export type CrawlDetailResult = {
  status: CrawlDetailStatus;
  url: string;
  sourceUid?: string;
  title?: string;
  reason?: string;
  crawledAt: string;
};

export type CrawlRunReport = {
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

export type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements?: OverpassElement[];
};

export type NearbyPoi = {
  overpassId: string;
  name: string;
  category: UtilityCategory;
  lat: number;
  lon: number;
  location?: string | null;
  distanceM: number;
  travelTimeS: number;
};

export type NearbyPoiFetchStatus =
  | "ok"
  | "no_poi"
  | "invalid_coordinates"
  | "rate_limited"
  | "server_timeout"
  | "request_failed"
  | "disabled";

export type NearbyPoiFetchResult = {
  status: NearbyPoiFetchStatus;
  pois: NearbyPoi[];
  httpStatus?: number;
  message?: string;
};

export type NearbyPoiSyncResult = {
  status: NearbyPoiFetchStatus;
  linked: number;
  httpStatus?: number;
  message?: string;
};

export type NearbyUtilitiesBackfillResult = {
  scanned: number;
  processed: number;
  linkedUtilities: number;
  failed: number;
  invalidCoordinates: number;
  noPoiFound: number;
  poiRequestFailed: number;
  rateLimited: number;
  serverTimeout: number;
};

export type NearbyUtilitiesBackfillStatus = {
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
  limit?: number;
  result?: NearbyUtilitiesBackfillResult;
  error?: string;
};
