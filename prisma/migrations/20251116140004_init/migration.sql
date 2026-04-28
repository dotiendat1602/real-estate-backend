-- CreateEnum
CREATE TYPE "StatusLogAction" AS ENUM ('INACTIVE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('SALE', 'RENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FurnitureStatus" AS ENUM ('UNFURNISHED', 'PARTLY_FURNISHED', 'FULLY_FURNISHED');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('FREEHOLD', 'LEASEHOLD', 'RED_BOOK', 'PINK_BOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CONFIRMED', 'REFUNDED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('ADMIN', 'MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "SystemPermissionType" AS ENUM ('MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_PAYMENT', 'MANAGE_PROPERTY', 'MANAGE_POST', 'MANAGE_CATEGORY', 'MANAGE_AMENITIES');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "AmenityCategory" AS ENUM ('INTERIOR', 'EXTERIOR', 'SECURITY', 'ACCESSIBILITY', 'COMMUNITY', 'PARKING', 'KITCHEN', 'BATHROOM', 'ENTERTAINMENT', 'ENERGY', 'SMART_HOME', 'PET_FRIENDLY', 'BUSINESS');

-- CreateEnum
CREATE TYPE "UtilityCategory" AS ENUM ('COMMERCIAL_SHOPPING', 'HEALTHCARE', 'EDUCATION', 'TRANSPORT', 'PARK_PLAZA', 'FINANCIAL', 'GOVERNMENT', 'ENTERTAINMENT', 'DINING', 'SPORTS', 'RELIGIOUS', 'FUEL', 'ACCOMMODATION', 'PARKING', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'NEGOTIATION', 'CONVERTED', 'LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACTION_TAKEN', 'REJECTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "lastLogin" TIMESTAMP(3),
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "name" "RoleType" NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "permission_id" SERIAL NOT NULL,
    "name" "SystemPermissionType" NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "roles_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "roles_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "otp" (
    "otp_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "purpose" "OtpPurpose",
    "expireTime" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("otp_id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provinces" (
    "province_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("province_id")
);

-- CreateTable
CREATE TABLE "districts" (
    "district_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "province_id" INTEGER NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("district_id")
);

-- CreateTable
CREATE TABLE "wards" (
    "ward_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "district_id" INTEGER NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("ward_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "category_id" SERIAL NOT NULL,
    "category_name" TEXT NOT NULL,
    "category_description" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "properties" (
    "property_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(18,2) NOT NULL,
    "area" DECIMAL(10,2),
    "bedroomNumber" INTEGER,
    "toiletNumber" INTEGER,
    "floorNumber" INTEGER,
    "parking" BOOLEAN,
    "orientation" TEXT,
    "frontage" DECIMAL(6,2),
    "roadWidth" DECIMAL(6,2),
    "furnitureStatus" "FurnitureStatus",
    "legalStatus" "LegalStatus",
    "yearBuilt" INTEGER,
    "lat" DECIMAL(9,6),
    "lon" DECIMAL(9,6),
    "location" TEXT,
    "category_id" INTEGER NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "ward_id" INTEGER,
    "district_id" INTEGER,
    "province_id" INTEGER,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("property_id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "image_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("image_id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "amenity_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AmenityCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("amenity_id")
);

-- CreateTable
CREATE TABLE "property_amenities" (
    "property_id" INTEGER NOT NULL,
    "amenity_id" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("property_id","amenity_id")
);

-- CreateTable
CREATE TABLE "property_utilities" (
    "property_id" INTEGER NOT NULL,
    "utility_id" INTEGER NOT NULL,
    "distance_m" DECIMAL(8,2),
    "travel_time_s" INTEGER,
    "is_primary" BOOLEAN DEFAULT false,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "property_utilities_pkey" PRIMARY KEY ("property_id","utility_id")
);

-- CreateTable
CREATE TABLE "utilities" (
    "utility_id" SERIAL NOT NULL,
    "utility_category" "UtilityCategory" NOT NULL,
    "utility_name" TEXT,
    "lat" DECIMAL(9,6),
    "lon" DECIMAL(9,6),
    "location" TEXT,
    "province_id" INTEGER,
    "district_id" INTEGER,
    "ward_id" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "utilities_pkey" PRIMARY KEY ("utility_id")
);

-- CreateTable
CREATE TABLE "posts" (
    "post_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "postTitle" TEXT NOT NULL,
    "postType" "PostType",
    "postContent" TEXT,
    "postStatus" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" INTEGER,
    "rejectReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "favorite_list" (
    "favorite_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_list_pkey" PRIMARY KEY ("favorite_id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "deposit_id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "transactionRef" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("deposit_id")
);

-- CreateTable
CREATE TABLE "leads" (
    "lead_id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "buyerId" INTEGER,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("lead_id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "conversation_id" SERIAL NOT NULL,
    "post_id" INTEGER,
    "buyerId" INTEGER,
    "agentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("conversation_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "message_id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "appointment_id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "AppointmentStatus" DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "report_id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "reporterId" INTEGER,
    "reason" TEXT,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "savedSearch_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT,
    "filtersJson" JSONB NOT NULL,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("savedSearch_id")
);

-- CreateTable
CREATE TABLE "post_slugs" (
    "slug_id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_slugs_pkey" PRIMARY KEY ("slug_id")
);

-- CreateTable
CREATE TABLE "log_actions" (
    "id" BIGSERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "body" TEXT NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "query" TEXT NOT NULL,
    "now" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" TEXT NOT NULL,
    "timeCall" INTEGER NOT NULL,
    "status" "StatusLogAction" NOT NULL,
    "user_id" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "districts_province_id_idx" ON "districts"("province_id");

-- CreateIndex
CREATE INDEX "wards_district_id_idx" ON "wards"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_category_name_key" ON "categories"("category_name");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_province_id_district_id_ward_id_idx" ON "properties"("province_id", "district_id", "ward_id");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_area_idx" ON "properties"("area");

-- CreateIndex
CREATE INDEX "properties_bedroomNumber_idx" ON "properties"("bedroomNumber");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "property_images_property_id_idx" ON "property_images"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_images_property_id_imageUrl_key" ON "property_images"("property_id", "imageUrl");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_name_key" ON "amenities"("name");

-- CreateIndex
CREATE INDEX "property_utilities_utility_id_idx" ON "property_utilities"("utility_id");

-- CreateIndex
CREATE INDEX "utilities_utility_category_idx" ON "utilities"("utility_category");

-- CreateIndex
CREATE INDEX "utilities_province_id_district_id_ward_id_idx" ON "utilities"("province_id", "district_id", "ward_id");

-- CreateIndex
CREATE INDEX "posts_postStatus_idx" ON "posts"("postStatus");

-- CreateIndex
CREATE INDEX "posts_createdById_idx" ON "posts"("createdById");

-- CreateIndex
CREATE INDEX "posts_property_id_idx" ON "posts"("property_id");

-- CreateIndex
CREATE INDEX "posts_publishedAt_idx" ON "posts"("publishedAt");

-- CreateIndex
CREATE INDEX "favorite_list_user_id_idx" ON "favorite_list"("user_id");

-- CreateIndex
CREATE INDEX "favorite_list_post_id_idx" ON "favorite_list"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_list_user_id_post_id_key" ON "favorite_list"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_transactionRef_key" ON "deposits"("transactionRef");

-- CreateIndex
CREATE INDEX "deposits_post_id_idx" ON "deposits"("post_id");

-- CreateIndex
CREATE INDEX "deposits_buyerId_idx" ON "deposits"("buyerId");

-- CreateIndex
CREATE INDEX "deposits_sellerId_idx" ON "deposits"("sellerId");

-- CreateIndex
CREATE INDEX "deposits_status_idx" ON "deposits"("status");

-- CreateIndex
CREATE INDEX "leads_post_id_idx" ON "leads"("post_id");

-- CreateIndex
CREATE INDEX "leads_buyerId_idx" ON "leads"("buyerId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "conversations_post_id_idx" ON "conversations"("post_id");

-- CreateIndex
CREATE INDEX "conversations_buyerId_idx" ON "conversations"("buyerId");

-- CreateIndex
CREATE INDEX "conversations_agentId_idx" ON "conversations"("agentId");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "appointments_post_id_idx" ON "appointments"("post_id");

-- CreateIndex
CREATE INDEX "appointments_buyerId_idx" ON "appointments"("buyerId");

-- CreateIndex
CREATE INDEX "appointments_sellerId_idx" ON "appointments"("sellerId");

-- CreateIndex
CREATE INDEX "appointments_scheduledAt_idx" ON "appointments"("scheduledAt");

-- CreateIndex
CREATE INDEX "reports_post_id_idx" ON "reports"("post_id");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_slugs_slug_key" ON "post_slugs"("slug");

-- CreateIndex
CREATE INDEX "post_slugs_post_id_idx" ON "post_slugs"("post_id");

-- CreateIndex
CREATE INDEX "post_slugs_isCurrent_idx" ON "post_slugs"("isCurrent");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp" ADD CONSTRAINT "otp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("province_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("district_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("ward_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("district_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("province_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("amenity_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_utilities" ADD CONSTRAINT "property_utilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_utilities" ADD CONSTRAINT "property_utilities_utility_id_fkey" FOREIGN KEY ("utility_id") REFERENCES "utilities"("utility_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("province_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("district_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("ward_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_list" ADD CONSTRAINT "favorite_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_list" ADD CONSTRAINT "favorite_list_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_slugs" ADD CONSTRAINT "post_slugs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("post_id") ON DELETE CASCADE ON UPDATE CASCADE;
