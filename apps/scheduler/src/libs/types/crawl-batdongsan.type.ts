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
  legalStatus?: 'FREEHOLD' | 'LEASEHOLD' | 'RED_BOOK' | 'PINK_BOOK' | 'OTHER';

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
