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
import { PlanningExplainDto } from "./dto/planning-explain.dto";
import { PlanningAiClientService } from "./services/planning-ai-client.service";
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

  async getPropertyPlanningExplain(propertyId: number, dto: PlanningExplainDto) {
    const summary = await this.getPropertyPlanningSummary(propertyId);
    const dossierCode = summary?.dossier?.code || null;
    const dossier = dossierCode ? await this.getPlanningDossier(dossierCode).catch(() => null) : null;

    return await this.planningAiClientService.explain({
      propertyId,
      question: dto?.question?.trim() || undefined,
      summary: {
        planningStatus: summary.planningStatus,
        riskLevel: summary.riskLevel,
        landUseCurrent: summary.landUseCurrent,
        landUsePlanned: summary.landUsePlanned,
        dossierCode: summary.dossier?.code || null,
        dossierName: summary.dossier?.name || null,
        checkedAt: summary.checkedAt ? new Date(summary.checkedAt).toISOString() : null,
      },
      documents: (dossier?.documents || []).map((doc) => ({
        title: this.sanitizeText(doc.title) || "Tai lieu quy hoach",
        format: this.sanitizeText(doc.format),
        docType: this.sanitizeText((doc as any)?.docType || null),
        sourcePath: this.sanitizeText((doc as any)?.sourcePath || null),
        rawMeta: this.sanitizeJson((doc as any)?.rawMeta || null),
      })),
    });
  }
}
