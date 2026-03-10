-- CreateEnum
CREATE TYPE "PlanningSourceType" AS ENUM ('QHKHSDD_HANOI', 'QUYHOACH_HANOI');

-- CreateEnum
CREATE TYPE "PlanningLookupStatus" AS ENUM ('MATCHED', 'NO_MATCH', 'ERROR');

-- CreateEnum
CREATE TYPE "PlanningConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PlanningRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DocumentDownloadStatus" AS ENUM ('PENDING', 'DOWNLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "planning_coordinate_lookups" (
    "id" SERIAL NOT NULL,
    "source" "PlanningSourceType" NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "ky_quy_hoach" TEXT,
    "status" "PlanningLookupStatus" NOT NULL,
    "raw_response" JSONB,
    "queried_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_coordinate_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_zones" (
    "id" SERIAL NOT NULL,
    "lookup_id" INTEGER NOT NULL,
    "ma_ho_so" TEXT,
    "loai_dat_ht" TEXT,
    "ten_loai_dat_ht" TEXT,
    "loai_dat_qh" TEXT,
    "ten_loai_dat_qh" TEXT,
    "raw_geom_wkt" TEXT,
    "geojson_simplified" JSONB,
    "bbox" JSONB,
    "attributes_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_dossiers" (
    "id" SERIAL NOT NULL,
    "source" "PlanningSourceType" NOT NULL,
    "ma_ho_so" TEXT NOT NULL,
    "ten_ho_so" TEXT NOT NULL,
    "district_name" TEXT,
    "district_code" TEXT,
    "raw_response" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_documents" (
    "id" SERIAL NOT NULL,
    "dossier_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "doc_type" TEXT,
    "format" TEXT,
    "source_path" TEXT,
    "source_url" TEXT,
    "download_status" "DocumentDownloadStatus" NOT NULL DEFAULT 'PENDING',
    "raw_meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_planning_matches" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "lookup_id" INTEGER,
    "zone_id" INTEGER,
    "status" "PlanningLookupStatus" NOT NULL,
    "risk_level" "PlanningRiskLevel",
    "confidence_level" "PlanningConfidence",
    "explanation" TEXT,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_planning_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planning_coordinate_lookups_lat_lng_idx" ON "planning_coordinate_lookups"("lat", "lng");

-- CreateIndex
CREATE INDEX "planning_coordinate_lookups_ky_quy_hoach_idx" ON "planning_coordinate_lookups"("ky_quy_hoach");

-- CreateIndex
CREATE UNIQUE INDEX "planning_coordinate_lookups_lat_lng_ky_quy_hoach_source_key" ON "planning_coordinate_lookups"("lat", "lng", "ky_quy_hoach", "source");

-- CreateIndex
CREATE INDEX "planning_zones_lookup_id_idx" ON "planning_zones"("lookup_id");

-- CreateIndex
CREATE INDEX "planning_zones_ma_ho_so_idx" ON "planning_zones"("ma_ho_so");

-- CreateIndex
CREATE UNIQUE INDEX "planning_dossiers_ma_ho_so_key" ON "planning_dossiers"("ma_ho_so");

-- CreateIndex
CREATE INDEX "planning_dossiers_district_code_idx" ON "planning_dossiers"("district_code");

-- CreateIndex
CREATE INDEX "planning_documents_dossier_id_idx" ON "planning_documents"("dossier_id");

-- CreateIndex
CREATE INDEX "property_planning_matches_property_id_idx" ON "property_planning_matches"("property_id");

-- CreateIndex
CREATE INDEX "property_planning_matches_status_idx" ON "property_planning_matches"("status");

-- AddForeignKey
ALTER TABLE "planning_zones" ADD CONSTRAINT "planning_zones_lookup_id_fkey" FOREIGN KEY ("lookup_id") REFERENCES "planning_coordinate_lookups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_zones" ADD CONSTRAINT "planning_zones_ma_ho_so_fkey" FOREIGN KEY ("ma_ho_so") REFERENCES "planning_dossiers"("ma_ho_so") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_documents" ADD CONSTRAINT "planning_documents_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "planning_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_planning_matches" ADD CONSTRAINT "property_planning_matches_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_planning_matches" ADD CONSTRAINT "property_planning_matches_lookup_id_fkey" FOREIGN KEY ("lookup_id") REFERENCES "planning_coordinate_lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_planning_matches" ADD CONSTRAINT "property_planning_matches_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "planning_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
