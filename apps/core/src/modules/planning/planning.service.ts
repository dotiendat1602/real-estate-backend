import { HttpStatus, Injectable } from "@nestjs/common";
import {
  DocumentDownloadStatus,
  PlanningConfidence,
  PlanningLookupStatus,
  PlanningRiskLevel,
  PlanningSourceType,
} from "@prisma/client";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { StorageService, UploadedFile } from "libs/modules/storage/storage.service";
import { ApiException } from "libs/utils/exception";
import { CoordinateLookupDto } from "./dto/coordinate-lookup.dto";
import { PlanningBatchIngestDto } from "./dto/planning-batch-ingest.dto";
import { PlanningIngestDto } from "./dto/planning-ingest.dto";
import { PlanningAiClientService } from "./services/planning-ai-client.service";
import { PlanningIngestJobData, PlanningIngestQueueService } from "./services/planning-ingest-queue.service";
import { QhkhsddHanoiAdapter } from "./services/qhkhsdd-hanoi.adapter";
import { computeBbox, wktToGeoJson } from "./utils/wkt-to-geojson";

@Injectable()
export class PlanningService {
  private readonly defaultKyQuyHoach = "KHSDĐ cấp huyện năm 2025";

  constructor(
    private readonly prismaService: PrismaService,
    private readonly qhkhsddHanoiAdapter: QhkhsddHanoiAdapter,
    private readonly storageService: StorageService,
    private readonly planningAiClientService: PlanningAiClientService,
    private readonly planningIngestQueueService: PlanningIngestQueueService,
  ) { }

  private roundCoordinate(value: number) {
    return Number(value.toFixed(7));
  }

  private sanitizeText(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return String(value).replace(/\u0000/g, "");
  }

  private sanitizeJson(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return value.replace(/\u0000/g, "");
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeJson(item));
    }

    if (typeof value === "object") {
      const output: Record<string, any> = {};
      for (const [key, item] of Object.entries(value)) {
        output[key] = this.sanitizeJson(item);
      }
      return output;
    }

    return value;
  }

  private normalizeFileName(input: string, extension?: string | null) {
    const base = (this.sanitizeText(input) || "planning-document")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    const ext = (extension || "").trim().replace(/^\./, "").toLowerCase();
    if (!ext) {
      return base;
    }

    return `${base}.${ext}`;
  }

  private async uploadPlanningDocumentToS3(params: {
    sourcePath: string;
    title: string;
    format?: string | null;
  }): Promise<string | null> {
    const binary = await this.qhkhsddHanoiAdapter.downloadDocumentBinary(params.sourcePath);
    if (!binary?.buffer?.length) {
      return null;
    }

    const lowerFormat = (params.format || "").toLowerCase();
    const ext = lowerFormat || "pdf";
    const mimeType = binary.contentType || (ext === "pdf" ? "application/pdf" : "application/octet-stream");

    const uploadedFile: UploadedFile = {
      fieldname: "file",
      originalName: this.normalizeFileName(params.title, ext),
      encoding: "7bit",
      mimetype: mimeType,
      destination: "",
      filename: this.normalizeFileName(params.title, ext),
      path: "",
      size: binary.buffer.length,
      buffer: binary.buffer,
    };

    try {
      const uploadResult = await this.storageService.uploadFile(
        [uploadedFile],
        "planning-documents",
        { addTimestampPrefix: true },
      );

      const first = Array.isArray(uploadResult) ? uploadResult[0] : null;

      if (typeof first === "string") {
        return first;
      }

      if (first && typeof first === "object" && "original" in first) {
        return this.sanitizeText((first as { original?: string }).original || null);
      }
    } catch {
      return null;
    }

    return null;
  }

  private normalizeZoneList(rawLookup: any): any[] {
    if (Array.isArray(rawLookup?.khoanhDatQuyHoach)) {
      return rawLookup.khoanhDatQuyHoach;
    }

    if (Array.isArray(rawLookup?.data?.khoanhDatQuyHoach)) {
      return rawLookup.data.khoanhDatQuyHoach;
    }

    if (Array.isArray(rawLookup)) {
      return rawLookup;
    }

    return [];
  }

  private pickDossierPayload(rawDossier: any) {
    if (!rawDossier) {
      return null;
    }

    if (Array.isArray(rawDossier) && rawDossier.length) {
      return rawDossier[0];
    }

    if (rawDossier?.maHoSo) {
      return rawDossier;
    }

    if (rawDossier?.data?.maHoSo) {
      return rawDossier.data;
    }

    if (Array.isArray(rawDossier?.data) && rawDossier.data.length) {
      return rawDossier.data[0];
    }

    return rawDossier;
  }

  private deriveConfidence(zoneCount: number, documentCount: number): PlanningConfidence {
    if (zoneCount > 0 && documentCount > 0) {
      return PlanningConfidence.HIGH;
    }

    if (zoneCount > 0) {
      return PlanningConfidence.MEDIUM;
    }

    return PlanningConfidence.UNKNOWN;
  }

  private deriveRiskLevel(zone: any): PlanningRiskLevel {
    const loaiDatHT = (zone?.loaiDatHT || "").toString().trim();
    const loaiDatQH = (zone?.loaiDatQH || "").toString().trim();

    if (!loaiDatQH || loaiDatQH === loaiDatHT) {
      return PlanningRiskLevel.LOW;
    }

    return PlanningRiskLevel.MEDIUM;
  }

  private async createLookupAndRelations(params: { lat: number; lng: number; kyQuyHoach: string }) {
    const rawLookup = await this.qhkhsddHanoiAdapter.lookupByCoordinate(params);
    const normalizedZones = this.normalizeZoneList(rawLookup);
    const lookupStatus = normalizedZones.length ? PlanningLookupStatus.MATCHED : PlanningLookupStatus.NO_MATCH;

    const lookup = await this.prismaService.planningCoordinateLookup.upsert({
      where: {
        lat_lng_kyQuyHoach_source: {
          lat: params.lat,
          lng: params.lng,
          kyQuyHoach: params.kyQuyHoach,
          source: PlanningSourceType.QHKHSDD_HANOI,
        },
      },
      update: {
        status: lookupStatus,
        rawResponse: this.sanitizeJson(rawLookup),
        queriedAt: new Date(),
      },
      create: {
        source: PlanningSourceType.QHKHSDD_HANOI,
        lat: params.lat,
        lng: params.lng,
        kyQuyHoach: params.kyQuyHoach,
        status: lookupStatus,
        rawResponse: this.sanitizeJson(rawLookup),
      },
    });

    const lookupLockKey = `planning-lookup:${lookup.id}`;
    await this.prismaService.$executeRaw`SELECT pg_advisory_lock(hashtext(${lookupLockKey}))`;

    try {
      // Refresh zones for this lookup to keep data consistent after re-check.
      await this.prismaService.planningZone.deleteMany({ where: { lookupId: lookup.id } });

      const dossierCache = new Map<string, { id: number; maHoSo: string }>();
      const zoneKeys = new Set<string>();

      for (const zone of normalizedZones) {
        const geomWkt = this.sanitizeText(zone?.geom);
        const geom = wktToGeoJson(geomWkt);
        const bbox = computeBbox(geom);
        const originalMaHoSo = this.sanitizeText(zone?.maHoSo);
        const zoneKey = `${geomWkt || ""}|${originalMaHoSo || ""}|${this.sanitizeText(zone?.loaiDatHT) || ""}|${this.sanitizeText(zone?.loaiDatQH) || ""}`;

        if (zoneKeys.has(zoneKey)) {
          continue;
        }
        zoneKeys.add(zoneKey);

        let resolvedMaHoSo: string | null = null;

        if (originalMaHoSo) {
          let dossier = dossierCache.get(originalMaHoSo);

          if (!dossier) {
            const rawDossier = await this.qhkhsddHanoiAdapter.getDossierDetail(originalMaHoSo).catch(() => null);
            const dossierPayload = this.pickDossierPayload(rawDossier);

            // Always keep zone.maHoSo consistent with source zone payload.
            const dossierCode = originalMaHoSo;
            const tenHoSo = this.sanitizeText(dossierPayload?.tenHoSo)
              || dossierCode;

            const upserted = await this.prismaService.planningDossier.upsert({
              where: { maHoSo: dossierCode },
              update: {
                tenHoSo,
                rawResponse: this.sanitizeJson(rawDossier) || undefined,
                fetchedAt: new Date(),
              },
              create: {
                source: PlanningSourceType.QHKHSDD_HANOI,
                maHoSo: dossierCode,
                tenHoSo,
                rawResponse: this.sanitizeJson(rawDossier) || undefined,
              },
            });

            if (dossierPayload) {
              const dossierLockKey = `planning-dossier:${dossierCode}`;
              await this.prismaService.$executeRaw`SELECT pg_advisory_lock(hashtext(${dossierLockKey}))`;

              try {
                // Replace previous docs by latest source snapshot when dossier payload is available.
                await this.prismaService.planningDocument.deleteMany({
                  where: { dossierId: upserted.id },
                });

                const documentItems = [
                  ...(Array.isArray(dossierPayload?.taiLieu) ? dossierPayload.taiLieu : []),
                  ...(Array.isArray(dossierPayload?.banVe) ? dossierPayload.banVe : []),
                ];
                const documentKeys = new Set<string>();

                for (const item of documentItems) {
                  const title = this.sanitizeText(item?.ten) || "Tài liệu quy hoạch";
                  const sourcePath = this.sanitizeText(item?.duongDanKhaiThac);
                  const format = this.sanitizeText(item?.dinhDangKhaiThac);
                  const dedupeKey = `${sourcePath || ""}|${title}|${format || ""}`;
                  if (documentKeys.has(dedupeKey)) {
                    continue;
                  }
                  documentKeys.add(dedupeKey);

                  const s3SourceUrl = sourcePath
                    ? await this.uploadPlanningDocumentToS3({
                      sourcePath,
                      title,
                      format,
                    })
                    : null;
                  const resolvedSourceUrl = sourcePath
                    ? await this.qhkhsddHanoiAdapter.resolveDocumentUrl(sourcePath)
                    : null;
                  const sourceUrl = this.sanitizeText(
                    s3SourceUrl || resolvedSourceUrl || this.qhkhsddHanoiAdapter.toAbsoluteUrl(sourcePath),
                  );

                  await this.prismaService.planningDocument.create({
                    data: {
                      dossierId: upserted.id,
                      title,
                      format,
                      docType: this.sanitizeText(item?.loaiTaiLieu),
                      sourcePath,
                      sourceUrl,
                      downloadStatus: DocumentDownloadStatus.PENDING,
                      rawMeta: this.sanitizeJson(item),
                    },
                  }).catch(() => null);
                }
              } finally {
                await this.prismaService.$executeRaw`SELECT pg_advisory_unlock(hashtext(${dossierLockKey}))`;
              }
            }

            dossier = { id: upserted.id, maHoSo: upserted.maHoSo };
            dossierCache.set(originalMaHoSo, dossier);
          }

          resolvedMaHoSo = dossier?.maHoSo || null;
        }

        await this.prismaService.planningZone.create({
          data: {
            lookupId: lookup.id,
            // Only persist maHoSo when dossier row exists to satisfy FK.
            maHoSo: resolvedMaHoSo,
            loaiDatHT: this.sanitizeText(zone?.loaiDatHT),
            tenLoaiDatHT: this.sanitizeText(zone?.tenLoaiDatHT),
            loaiDatQH: this.sanitizeText(zone?.loaiDatQH),
            tenLoaiDatQH: this.sanitizeText(zone?.tenLoaiDatQH),
            rawGeomWkt: geomWkt,
            geojsonSimplified: this.sanitizeJson(geom) || undefined,
            bbox: this.sanitizeJson(bbox) || undefined,
            attributesJson: this.sanitizeJson(zone),
          },
        });
      }
    } finally {
      await this.prismaService.$executeRaw`SELECT pg_advisory_unlock(hashtext(${lookupLockKey}))`;
    }

    return this.prismaService.planningCoordinateLookup.findUnique({
      where: { id: lookup.id },
      include: {
        zones: {
          include: {
            dossier: {
              include: {
                documents: true,
              },
            },
          },
        },
      },
    });
  }

  private buildLookupResponse(lookup: any) {
    const zones = lookup?.zones || [];
    const firstZone = zones[0];
    const documentList = (firstZone?.dossier?.documents || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      format: doc.format,
      url: doc.sourceUrl,
    }));

    const confidence = this.deriveConfidence(zones.length, documentList.length);
    return {
      status: lookup?.status,
      source: lookup?.source,
      query: {
        lat: Number(lookup?.lat),
        lng: Number(lookup?.lng),
        kyQuyHoach: lookup?.kyQuyHoach,
      },
      summary: {
        loaiDatHT: firstZone?.loaiDatHT || null,
        tenLoaiDatHT: firstZone?.tenLoaiDatHT || null,
        loaiDatQH: firstZone?.loaiDatQH || null,
        tenLoaiDatQH: firstZone?.tenLoaiDatQH || null,
        maHoSo: firstZone?.maHoSo || null,
        tenHoSo: firstZone?.dossier?.tenHoSo || null,
      },
      overlays: zones
        .filter((zone: any) => zone?.geojsonSimplified)
        .map((zone: any) => ({
          geometryType: zone.geojsonSimplified?.type || null,
          geojson: zone.geojsonSimplified,
          bbox: zone.bbox,
        })),
      documents: documentList,
      confidence: {
        level: confidence,
        reason:
          confidence === PlanningConfidence.HIGH
            ? "Có polygon + có maHoSo + có tài liệu hồ sơ"
            : confidence === PlanningConfidence.MEDIUM
              ? "Có polygon quy hoạch nhưng tài liệu chưa đầy đủ"
              : "Chưa có đủ dữ liệu để kết luận",
      },
      checkedAt: lookup?.queriedAt,
    };
  }

  async lookupByCoordinate(dto: CoordinateLookupDto) {
    const lat = this.roundCoordinate(dto.lat);
    const lng = this.roundCoordinate(dto.lng);
    const kyQuyHoach = dto.kyQuyHoach?.trim() || this.defaultKyQuyHoach;

    const existing = await this.prismaService.planningCoordinateLookup.findFirst({
      where: {
        source: PlanningSourceType.QHKHSDD_HANOI,
        lat,
        lng,
        kyQuyHoach,
      },
      orderBy: { queriedAt: "desc" },
      include: {
        zones: {
          include: {
            dossier: {
              include: {
                documents: true,
              },
            },
          },
        },
      },
    });

    if (existing && !dto.forceRefresh) {
      return this.buildLookupResponse(existing);
    }

    try {
      const created = await this.createLookupAndRelations({ lat, lng, kyQuyHoach });
      return this.buildLookupResponse(created);
    } catch (error) {
      throw new ApiException("Lookup quy hoạch thất bại", HttpStatus.BAD_GATEWAY);
    }
  }

  private async getOrCreateLatestPropertyMatch(propertyId: number) {
    const property = await this.prismaService.property.findFirst({
      where: {
        id: propertyId,
        deletedAt: null,
      },
      select: {
        id: true,
        lat: true,
        lon: true,
      },
    });

    if (!property) {
      throw new ApiException("Property not found", HttpStatus.NOT_FOUND);
    }

    let latestMatch = await this.prismaService.propertyPlanningMatch.findFirst({
      where: { propertyId: property.id },
      orderBy: { matchedAt: "desc" },
      include: {
        lookup: true,
        zone: {
          include: {
            dossier: {
              include: {
                documents: true,
              },
            },
          },
        },
      },
    });

    if (latestMatch) {
      return { property, latestMatch };
    }

    if (property.lat === null || property.lon === null) {
      return { property, latestMatch: null };
    }

    const lookupResult = await this.lookupByCoordinate({
      lat: Number(property.lat),
      lng: Number(property.lon),
      forceRefresh: false,
    });

    const lookup = await this.prismaService.planningCoordinateLookup.findFirst({
      where: {
        source: PlanningSourceType.QHKHSDD_HANOI,
        lat: this.roundCoordinate(Number(property.lat)),
        lng: this.roundCoordinate(Number(property.lon)),
        kyQuyHoach: lookupResult?.query?.kyQuyHoach || this.defaultKyQuyHoach,
      },
      orderBy: { queriedAt: "desc" },
      include: {
        zones: {
          include: {
            dossier: {
              include: {
                documents: true,
              },
            },
          },
        },
      },
    });

    if (!lookup) {
      return { property, latestMatch: null };
    }

    const firstZone = lookup.zones[0];
    latestMatch = await this.prismaService.$transaction(async (tx) => {
      // Lock property row to avoid duplicate matches when summary/map are called concurrently.
      await tx.$queryRaw`SELECT id FROM "properties" WHERE id = ${property.id} FOR UPDATE`;

      const existingMatch = await tx.propertyPlanningMatch.findFirst({
        where: { propertyId: property.id },
        orderBy: { matchedAt: "desc" },
      });

      const data = {
        lookupId: lookup.id,
        zoneId: firstZone?.id || null,
        status: lookup.status,
        riskLevel: firstZone ? this.deriveRiskLevel(firstZone) : null,
        confidenceLevel: this.deriveConfidence(lookup.zones.length, firstZone?.dossier?.documents?.length || 0),
        explanation: "Auto-generated from coordinate lookup",
        matchedAt: new Date(),
      };

      const ensured = existingMatch
        ? await tx.propertyPlanningMatch.update({
          where: { id: existingMatch.id },
          data,
        })
        : await tx.propertyPlanningMatch.create({
          data: {
            propertyId: property.id,
            ...data,
          },
        });

      await tx.propertyPlanningMatch.deleteMany({
        where: {
          propertyId: property.id,
          id: { not: ensured.id },
        },
      });

      return tx.propertyPlanningMatch.findUnique({
        where: { id: ensured.id },
        include: {
          lookup: true,
          zone: {
            include: {
              dossier: {
                include: {
                  documents: true,
                },
              },
            },
          },
        },
      });
    });

    return { property, latestMatch };
  }

  async getPropertyPlanningSummary(propertyId: number) {
    const { latestMatch } = await this.getOrCreateLatestPropertyMatch(propertyId);

    if (!latestMatch) {
      return {
        propertyId,
        planningStatus: PlanningLookupStatus.NO_MATCH,
        riskLevel: null,
        badge: "Chưa đủ dữ liệu để kết luận",
        landUseCurrent: null,
        landUsePlanned: null,
        dossier: null,
        checkedAt: null,
      };
    }

    return {
      propertyId,
      planningStatus: latestMatch.status,
      riskLevel: latestMatch.riskLevel,
      badge:
        latestMatch.status === PlanningLookupStatus.MATCHED
          ? "Đã có dữ liệu quy hoạch tham chiếu"
          : "Chưa đủ dữ liệu để kết luận",
      landUseCurrent: latestMatch.zone?.tenLoaiDatHT || null,
      landUsePlanned: latestMatch.zone?.tenLoaiDatQH || null,
      dossier: latestMatch.zone?.dossier
        ? {
          code: latestMatch.zone.dossier.maHoSo,
          name: latestMatch.zone.dossier.tenHoSo,
        }
        : null,
      checkedAt: latestMatch.lookup?.queriedAt || latestMatch.matchedAt,
    };
  }

  async getPropertyPlanningMap(propertyId: number) {
    const { property, latestMatch } = await this.getOrCreateLatestPropertyMatch(propertyId);
    return {
      property: {
        lat: property.lat !== null ? Number(property.lat) : null,
        lng: property.lon !== null ? Number(property.lon) : null,
      },
      layers:
        latestMatch?.zone?.geojsonSimplified
          ? [
            {
              id: `planning_zone_${latestMatch.zone.id}`,
              name: "Khoanh đất quy hoạch",
              source: PlanningSourceType.QHKHSDD_HANOI,
              style: {
                stroke: "#d33",
                fill: "rgba(211,51,51,0.15)",
              },
              geojson: latestMatch.zone.geojsonSimplified,
              bbox: latestMatch.zone.bbox,
              meta: {
                loaiDatHT: latestMatch.zone.tenLoaiDatHT,
                loaiDatQH: latestMatch.zone.tenLoaiDatQH,
                maHoSo: latestMatch.zone.maHoSo,
                tenHoSo: latestMatch.zone?.dossier?.tenHoSo,
              },
            },
          ]
          : [],
    };
  }

  async getPlanningDossier(maHoSo: string) {
    const dossierCode = maHoSo?.trim();
    if (!dossierCode) {
      throw new ApiException("Mã hồ sơ không hợp lệ", HttpStatus.BAD_REQUEST);
    }

    const dossier = await this.prismaService.planningDossier.findUnique({
      where: { maHoSo: dossierCode },
      include: {
        documents: {
          orderBy: [
            { format: "asc" },
            { createdAt: "desc" },
          ],
        },
      },
    });

    if (!dossier) {
      throw new ApiException("Không tìm thấy hồ sơ quy hoạch", HttpStatus.NOT_FOUND);
    }

    return {
      maHoSo: dossier.maHoSo,
      tenHoSo: dossier.tenHoSo,
      source: dossier.source,
      fetchedAt: dossier.fetchedAt,
      documents: dossier.documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        docType: doc.docType,
        format: doc.format,
        sourceUrl: doc.sourceUrl,
        sourcePath: doc.sourcePath,
        rawMeta: doc.rawMeta,
        downloadStatus: doc.downloadStatus,
        createdAt: doc.createdAt,
      })),
    };
  }

  private extractPlanYear(value?: string | null): number | null {
    if (!value) {
      return null;
    }

    const match = value.match(/(20\d{2})/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return null;
    }

    return year;
  }

  private inferDistrictFromDossierName(value?: string | null): string | null {
    const cleaned = this.sanitizeText(value);
    if (!cleaned) {
      return null;
    }

    const districtMatch = cleaned.match(/qu[ạa]n\s+([^,\-]+)/i);
    if (districtMatch?.[1]) {
      return districtMatch[1].trim();
    }

    const districtBySlash = cleaned.split("-").pop()?.trim();
    return districtBySlash || null;
  }

  private buildPlanningIngestDocuments(params: {
    propertyId: number;
    summary: any;
    dossier: any;
  }) {
    const { propertyId, summary, dossier } = params;
    const dossierCode = summary?.dossier?.code || null;
    const planYear = this.extractPlanYear(summary?.dossier?.name || null);
    const district = this.inferDistrictFromDossierName(summary?.dossier?.name || null);

    return (dossier?.documents || [])
      .filter((doc: any) => Boolean(doc?.id && doc?.sourceUrl))
      .map((doc: any) => ({
        planningDocumentId: Number(doc.id),
        title: this.sanitizeText(doc.title) || "Tai lieu quy hoach",
        sourceUrl: this.sanitizeText(doc.sourceUrl) || "",
        format: this.sanitizeText(doc.format),
        documentType: this.sanitizeText(doc.docType),
        dossierCode,
        city: "Ha Noi",
        district,
        planYear,
        propertyId,
        rawMeta: this.sanitizeJson({
          ...(doc.rawMeta || {}),
          district,
          planYear,
          dossierCode,
          sourcePath: doc.sourcePath,
        }),
      }))
      .filter((item: any) => Boolean(item.sourceUrl));
  }

  private async buildPlanningIngestJobData(propertyId: number, dto: PlanningIngestDto): Promise<PlanningIngestJobData> {
    const summary = await this.getPropertyPlanningSummary(propertyId);
    const dossierCode = summary?.dossier?.code || null;
    const dossier = dossierCode ? await this.getPlanningDossier(dossierCode).catch(() => null) : null;

    const replaceExisting = dto?.replaceExisting !== false;
    const ingestDocuments = this.buildPlanningIngestDocuments({
      propertyId,
      summary,
      dossier,
    });

    if (!ingestDocuments.length) {
      throw new ApiException("Khong co tai lieu co sourceUrl de ingest", HttpStatus.BAD_REQUEST);
    }

    return {
      propertyId,
      dossierCode,
      replaceExisting,
      totalDocuments: ingestDocuments.length,
      ingestRequest: {
        replaceExisting,
        documents: ingestDocuments,
      },
      trigger: "manual",
    };
  }

  private resolveBatchIngestConcurrency(requestedConcurrency?: number): number {
    const envConcurrency = Number(process.env.PLANNING_BATCH_INGEST_CONCURRENCY || 0);
    const fallback = Number.isInteger(envConcurrency) && envConcurrency > 0 ? envConcurrency : 5;

    const requested =
      typeof requestedConcurrency === "number" && Number.isInteger(requestedConcurrency) && requestedConcurrency > 0
        ? requestedConcurrency
        : fallback;

    return Math.max(1, Math.min(20, requested));
  }

  private normalizeBatchPropertyIds(propertyIds: number[]): number[] {
    const unique = new Set<number>();

    for (const rawId of propertyIds || []) {
      if (!Number.isInteger(rawId) || rawId <= 0) {
        continue;
      }

      unique.add(rawId);
    }

    return Array.from(unique);
  }

  private extractBatchError(error: unknown): { message: string; statusCode: number } {
    if (error instanceof ApiException) {
      return {
        message: String(error.message || "Ingest batch failed"),
        statusCode: error.getStatus(),
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message || "Ingest batch failed",
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    return {
      message: "Ingest batch failed",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private async mapWithConcurrency<TInput, TResult>(
    items: TInput[],
    concurrency: number,
    worker: (item: TInput, index: number) => Promise<TResult>,
  ): Promise<TResult[]> {
    if (!items.length) {
      return [];
    }

    const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
    const output = new Array<TResult>(items.length);
    let cursor = 0;

    const runner = async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;

        if (currentIndex >= items.length) {
          return;
        }

        output[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    };

    await Promise.all(Array.from({ length: safeConcurrency }, () => runner()));
    return output;
  }

  async ingestPlanningDocumentsByPropertyIds(dto: PlanningBatchIngestDto) {
    const propertyIds = this.normalizeBatchPropertyIds(dto?.propertyIds || []);
    if (!propertyIds.length) {
      throw new ApiException("Danh sach propertyId khong hop le", HttpStatus.BAD_REQUEST);
    }

    const replaceExisting = dto?.replaceExisting !== false;
    const concurrency = this.resolveBatchIngestConcurrency(dto?.concurrency);
    const startedAt = Date.now();

    const items = await this.mapWithConcurrency(propertyIds, concurrency, async (propertyId) => {
      try {
        const jobData = await this.buildPlanningIngestJobData(propertyId, { replaceExisting });
        const queued = await this.planningIngestQueueService.enqueue(jobData);

        return {
          ok: true,
          queued: true,
          alreadyQueued: queued.alreadyQueued,
          status: queued.status,
          jobId: queued.jobId,
          propertyId: jobData.propertyId,
          dossierCode: jobData.dossierCode,
          replaceExisting: jobData.replaceExisting,
          totalDocuments: jobData.totalDocuments,
          message: queued.alreadyQueued
            ? "Ingest job da ton tai va dang duoc xu ly"
            : "Da tao ingest job, vui long theo doi trang thai qua endpoint status",
        };
      } catch (error) {
        const parsedError = this.extractBatchError(error);

        return {
          ok: false,
          queued: false,
          alreadyQueued: false,
          status: "failed",
          jobId: null,
          propertyId,
          dossierCode: null,
          replaceExisting,
          totalDocuments: 0,
          message: parsedError.message,
          errorStatusCode: parsedError.statusCode,
        };
      }
    });

    const failedProperties = items.filter((item) => !item.ok).length;
    const queuedJobs = items.filter((item) => item.ok && !item.alreadyQueued).length;
    const alreadyQueued = items.filter((item) => item.ok && item.alreadyQueued).length;

    return {
      ok: failedProperties === 0,
      queued: true,
      totalProperties: propertyIds.length,
      queuedJobs,
      alreadyQueued,
      failedProperties,
      replaceExisting,
      concurrency,
      elapsedMs: Date.now() - startedAt,
      items,
    };
  }

  async executeQueuedPlanningIngest(jobData: PlanningIngestJobData) {
    const ingestResult = await this.planningAiClientService.ingestDocuments(jobData.ingestRequest);

    return {
      ...ingestResult,
      propertyId: jobData.propertyId,
      dossierCode: jobData.dossierCode,
      replaceExisting: jobData.replaceExisting,
      totalDocuments: jobData.totalDocuments,
    };
  }

  async ingestPropertyPlanningDocuments(propertyId: number, dto: PlanningIngestDto) {
    const jobData = await this.buildPlanningIngestJobData(propertyId, dto);
    const queued = await this.planningIngestQueueService.enqueue(jobData);

    return {
      ok: true,
      queued: true,
      alreadyQueued: queued.alreadyQueued,
      status: queued.status,
      jobId: queued.jobId,
      propertyId: jobData.propertyId,
      dossierCode: jobData.dossierCode,
      replaceExisting: jobData.replaceExisting,
      totalDocuments: jobData.totalDocuments,
      message: queued.alreadyQueued
        ? "Ingest job da ton tai va dang duoc xu ly"
        : "Da tao ingest job, vui long theo doi trang thai qua endpoint status",
    };
  }

  async getPlanningIngestJobStatus(propertyId: number, jobId: string) {
    return await this.planningIngestQueueService.getStatus(propertyId, jobId);
  }
}
