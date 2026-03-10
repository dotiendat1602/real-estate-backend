import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import * as https from "https";
import { CoreConfigService } from "../../config/core-config.service";

@Injectable()
export class QhkhsddHanoiAdapter {
  private readonly logger = new Logger(QhkhsddHanoiAdapter.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly client: AxiosInstance;

  constructor(private readonly coreConfigService: CoreConfigService) {
    this.baseUrl =
      this.coreConfigService.get("PLANNING_QHKHSDD_BASE_URL") ||
      "https://qhkhsdd.hanoi.gov.vn";

    this.timeout = +(this.coreConfigService.get("PLANNING_QHKHSDD_TIMEOUT") || 15000);

    const allowInsecureSsl =
      this.coreConfigService.get("PLANNING_QHKHSDD_ALLOW_INSECURE_SSL") === "true";

    this.client = axios.create({
      timeout: this.timeout,
      httpsAgent: new https.Agent({
        rejectUnauthorized: !allowInsecureSsl,
      }),
    });
  }

  async lookupByCoordinate(params: { lat: number; lng: number; kyQuyHoach: string }) {
    const url = `${this.baseUrl}/DatDaiServices/rest/datdai/gsv_data/hanoistnmt/quyHoachSuDungDat/traCuuTheoToaDoV2`;

    try {
      const response = await this.client.get(url, {
        params: {
          kyQuyHoach: params.kyQuyHoach,
          lng: params.lng,
          lat: params.lat,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error("lookupByCoordinate failed", {
        message: error?.message,
        code: error?.code,
        url,
        params,
      });
      throw error;
    }
  }

  async getDossierDetail(maHoSo: string) {
    const encodedMaHoSo = encodeURIComponent(maHoSo);
    const url = `${this.baseUrl}/KhoHoSoService/rest/gdoc/gsv_data/hanoistnmt/khoso/truyVanChiTietHoSo/${encodedMaHoSo}`;

    try {
      const response = await this.client.get(url);
      return response.data;
    } catch (error: any) {
      this.logger.error("getDossierDetail failed", {
        message: error?.message,
        code: error?.code,
        url,
        maHoSo,
      });
      throw error;
    }
  }

  async resolveDocumentUrl(duongDanKhaiThac: string): Promise<string | null> {
    const rawPath = (duongDanKhaiThac || "").trim();
    if (!rawPath) {
      return null;
    }

    // Keep slash separators while safely encoding each path segment.
    const normalized = rawPath
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const url = `${this.baseUrl}/KhoHoSoService/rest/gdrs/drs/${normalized}`;

    try {
      const response = await this.client.get(url);
      const payload = response.data;

      if (typeof payload === "string" && /^https?:\/\//i.test(payload)) {
        return payload;
      }

      if (typeof payload?.data === "string" && /^https?:\/\//i.test(payload.data)) {
        return payload.data;
      }

      if (typeof payload?.url === "string" && /^https?:\/\//i.test(payload.url)) {
        return payload.url;
      }

      if (typeof payload?.downloadUrl === "string" && /^https?:\/\//i.test(payload.downloadUrl)) {
        return payload.downloadUrl;
      }

      return null;
    } catch (error: any) {
      this.logger.warn("resolveDocumentUrl failed", {
        message: error?.message,
        code: error?.code,
        duongDanKhaiThac,
      });
      return null;
    }
  }

  async downloadDocumentBinary(duongDanKhaiThac: string): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    const rawPath = (duongDanKhaiThac || "").trim();
    if (!rawPath) {
      return null;
    }

    const normalized = rawPath
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const url = `${this.baseUrl}/KhoHoSoService/rest/gdrs/drs/${normalized}`;

    try {
      const response = await this.client.get(url, {
        responseType: "arraybuffer",
      });

      const contentType = typeof response.headers?.["content-type"] === "string"
        ? response.headers["content-type"]
        : null;

      if (!response.data) {
        return null;
      }

      return {
        buffer: Buffer.from(response.data),
        contentType,
      };
    } catch (error: any) {
      this.logger.warn("downloadDocumentBinary failed", {
        message: error?.message,
        code: error?.code,
        duongDanKhaiThac,
      });
      return null;
    }
  }

  toAbsoluteUrl(path?: string | null): string | null {
    if (!path) {
      return null;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  }
}
