import { CrawledProperty } from "../types/crawl-batdongsan.type";

// ---------------------------
// DMS -> Decimal
// ---------------------------
export function dmsToDecimal(d: number, m: number, s: number, dir: string): number {
  const dec = d + m / 60 + s / 3600;
  const neg = dir === "S" || dir === "W";
  return neg ? -dec : dec;
}

// ---------------------------
// Locale number parser (FIX 6.5 / 6,5 -> 6.5)
// ---------------------------
export function parseLocaleNumber(raw: string): number {
  let s = String(raw || "").trim();
  if (!s) return NaN;

  s = s.replace(/\u00A0/g, " ").replace(/\s+/g, ""); // remove space/NBSP

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  // both => last is decimal sep, the other is thousand sep
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    const decSep = lastDot > lastComma ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";

    const parts = s.split(decSep);
    const intPart = parts[0].split(thouSep).join("");
    const fracPart = parts.slice(1).join("");
    const normalized = fracPart ? `${intPart}.${fracPart}` : intPart;
    return Number(normalized);
  }

  // only comma
  if (!hasDot && hasComma) {
    const seg = s.split(",");
    // decimal comma if exactly 1 comma and fractional length <=2
    if (seg.length === 2 && seg[1].length > 0 && seg[1].length <= 2) return Number(`${seg[0]}.${seg[1]}`);
    // thousand separator
    return Number(seg.join(""));
  }

  // only dot
  if (hasDot && !hasComma) {
    const seg = s.split(".");
    // decimal dot if exactly 1 dot and fractional length <=2
    if (seg.length === 2 && seg[1].length > 0 && seg[1].length <= 2) return Number(s);
    // thousand separator
    return Number(seg.join(""));
  }

  return Number(s);
}

// ---------------------------
// Price/Area parsers
// ---------------------------
export function parsePrice(priceText: string): number | undefined {
  const t = (priceText || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t || t.includes("thỏa thuận")) return undefined;

  // ignore /m2
  if (t.includes("/m") || t.includes("m²")) return undefined;

  const m = t.match(/-?[\d.,]+/);
  if (!m?.[0]) return undefined;

  const n = parseLocaleNumber(m[0]);
  if (!Number.isFinite(n)) return undefined;

  if (t.includes("tỷ")) return Math.round(n * 1_000_000_000);
  if (t.includes("triệu")) return Math.round(n * 1_000_000);
  if (t.includes("nghìn")) return Math.round(n * 1_000);

  return undefined;
}

export function parsePriceFromText(bodyText: string): number | undefined {
  const t = (bodyText || "").toLowerCase();

  const mTy = t.match(/(-?[\d.,]+)\s*tỷ/);
  if (mTy?.[1]) {
    const n = parseLocaleNumber(mTy[1]);
    if (Number.isFinite(n)) return Math.round(n * 1_000_000_000);
  }

  const mTr = t.match(/(-?[\d.,]+)\s*triệu/);
  if (mTr?.[1]) {
    const n = parseLocaleNumber(mTr[1]);
    if (Number.isFinite(n)) return Math.round(n * 1_000_000);
  }

  return undefined;
}

export function parseArea(areaText: string): number | undefined {
  const t = (areaText || "").toLowerCase().replace(/\s+/g, " ").trim();
  const m = t.match(/(-?[\d.,]+)\s*(m2|m²)/i);
  if (!m?.[1]) return undefined;

  const n = parseLocaleNumber(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function parseAreaFromText(bodyText: string): number | undefined {
  const t = (bodyText || "").toLowerCase().replace(/\s+/g, " ");
  const m = t.match(/(-?[\d.,]+)\s*(m2|m²)/i);
  if (!m?.[1]) return undefined;

  const n = parseLocaleNumber(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export function parseNumber(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

export function parseDecimal(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/-?[\d.,]+/);
  if (!m?.[0]) return undefined;

  const n = parseLocaleNumber(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------
// Map enums
// ---------------------------
export function mapLegalStatus(raw?: string): CrawledProperty["legalStatus"] {
  const t = (raw || "").toLowerCase();
  if (!t) return undefined;

  const hasDo = t.includes("sổ đỏ");
  const hasHong = t.includes("sổ hồng");
  if (hasDo && hasHong) return "OTHER";
  if (hasDo) return "RED_BOOK";
  if (hasHong) return "PINK_BOOK";

  const saleContractsKeywords = ["hợp đồng mua bán", "hdmb", "sale contract", "sale agreement"];
  if (saleContractsKeywords.some((k) => t.includes(k))) return "SALE_CONTRACT";

  if (t.includes("freehold")) return "FREEHOLD";
  if (t.includes("leasehold")) return "LEASEHOLD";
  return "OTHER";
}

export function mapFurnitureStatus(raw?: string): CrawledProperty["furnitureStatus"] {
  const t = (raw || "").toLowerCase();
  if (!t) return undefined;

  if (t.includes("đầy đủ") || t.includes("full")) return "FULLY_FURNISHED";
  if (t.includes("cơ bản") || t.includes("một phần") || t.includes("part")) return "PARTLY_FURNISHED";
  if (t.includes("không") || t.includes("trống")) return "UNFURNISHED";
  return undefined;
}

export function mapOrientation(raw?: string): CrawledProperty["orientation"] {
  const t = (raw || "").toLowerCase();
  if (t.includes("đông bắc") || t.includes("northeast")) return "Đông Bắc";
  if (t.includes("đông nam") || t.includes("southeast")) return "Đông Nam";
  if (t.includes("tây bắc") || t.includes("northwest")) return "Tây Bắc";
  if (t.includes("tây nam") || t.includes("southwest")) return "Tây Nam";
  if (t.includes("đông") || t.includes("east")) return "Đông";
  if (t.includes("tây") || t.includes("west")) return "Tây";
  if (t.includes("nam") || t.includes("south")) return "Nam";
  if (t.includes("bắc") || t.includes("north")) return "Bắc";
  return undefined;
}

// ---------------------------
// Description formatter
// ---------------------------
export function formatDescription(text: string): string {
  if (!text) return "";

  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(/\.([A-Za-zÀ-ỹ])/g, ". $1")
    .replace(/\.\s*-\s*/g, ".\n- ")
    .replace(/\n/g, "<br/>");
}

export function normalizeKey(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .trim();
}
