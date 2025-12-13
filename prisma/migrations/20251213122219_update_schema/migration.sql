/*
  Warnings:

  - The primary key for the `amenities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `amenity_id` on the `amenities` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `amenities` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `amenities` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `amenities` table. All the data in the column will be lost.
  - The primary key for the `appointments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `agentId` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `appointment_id` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `buyerId` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `appointments` table. All the data in the column will be lost.
  - The primary key for the `audit_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `audit_id` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `categories` table. All the data in the column will be lost.
  - The primary key for the `conversations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `agentId` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `buyerId` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `conversation_id` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `conversations` table. All the data in the column will be lost.
  - The primary key for the `deposits` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `buyerId` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedAt` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `deposit_id` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `holdExpiresAt` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `releasedAt` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `sellerId` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `transactionRef` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `deposits` table. All the data in the column will be lost.
  - The primary key for the `districts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `district_id` on the `districts` table. All the data in the column will be lost.
  - The primary key for the `favorite_list` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `favorite_list` table. All the data in the column will be lost.
  - You are about to drop the column `favorite_id` on the `favorite_list` table. All the data in the column will be lost.
  - The primary key for the `leads` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `agentId` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `buyerId` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `lead_id` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `log_actions` table. All the data in the column will be lost.
  - You are about to drop the column `timeCall` on the `log_actions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `log_actions` table. All the data in the column will be lost.
  - The primary key for the `messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `message_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `senderId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `messages` table. All the data in the column will be lost.
  - The primary key for the `otp` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `otp` table. All the data in the column will be lost.
  - You are about to drop the column `expireTime` on the `otp` table. All the data in the column will be lost.
  - You are about to drop the column `otp_id` on the `otp` table. All the data in the column will be lost.
  - The primary key for the `permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `permission_id` on the `permissions` table. All the data in the column will be lost.
  - The primary key for the `post_slugs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `post_slugs` table. All the data in the column will be lost.
  - You are about to drop the column `isCurrent` on the `post_slugs` table. All the data in the column will be lost.
  - You are about to drop the column `slug_id` on the `post_slugs` table. All the data in the column will be lost.
  - The primary key for the `posts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `approvedAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `approvedById` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `postContent` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `postStatus` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `postTitle` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `postType` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `post_id` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `rejectReason` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `rejectedById` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `posts` table. All the data in the column will be lost.
  - The primary key for the `properties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `furnitureStatus` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `legalStatus` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `property_id` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `yearBuilt` on the `properties` table. All the data in the column will be lost.
  - The primary key for the `property_amenities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deletedAt` on the `property_amenities` table. All the data in the column will be lost.
  - The primary key for the `property_images` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `property_images` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `property_images` table. All the data in the column will be lost.
  - You are about to drop the column `image_id` on the `property_images` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimary` on the `property_images` table. All the data in the column will be lost.
  - The primary key for the `property_utilities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deletedAt` on the `property_utilities` table. All the data in the column will be lost.
  - The primary key for the `provinces` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `province_id` on the `provinces` table. All the data in the column will be lost.
  - The primary key for the `reports` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the column `report_id` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the column `reporterId` on the `reports` table. All the data in the column will be lost.
  - The primary key for the `roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `role_id` on the `roles` table. All the data in the column will be lost.
  - The primary key for the `saved_searches` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `saved_searches` table. All the data in the column will be lost.
  - You are about to drop the column `filtersJson` on the `saved_searches` table. All the data in the column will be lost.
  - You are about to drop the column `notifyEmail` on the `saved_searches` table. All the data in the column will be lost.
  - You are about to drop the column `savedSearch_id` on the `saved_searches` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastLogin` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `users` table. All the data in the column will be lost.
  - The primary key for the `utilities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deletedAt` on the `utilities` table. All the data in the column will be lost.
  - You are about to drop the column `utility_id` on the `utilities` table. All the data in the column will be lost.
  - The primary key for the `wards` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `ward_id` on the `wards` table. All the data in the column will be lost.
  - You are about to drop the `PasswordResetToken` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[post_id,buyer_id,agent_id]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[transaction_ref]` on the table `deposits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[property_id,amenity_id]` on the table `property_amenities` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[property_id,image_url]` on the table `property_images` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[property_id,utility_id]` on the table `property_utilities` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `buyer_id` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduled_at` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buyer_id` to the `deposits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seller_id` to the `deposits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time_call` to the `log_actions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sender_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expire_time` to the `otp` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by_id` to the `posts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `post_title` to the `posts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `image_url` to the `property_images` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filters_json` to the `saved_searches` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_user_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_agentId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_agentId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_post_id_fkey";

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_post_id_fkey";

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "districts" DROP CONSTRAINT "districts_province_id_fkey";

-- DropForeignKey
ALTER TABLE "favorite_list" DROP CONSTRAINT "favorite_list_post_id_fkey";

-- DropForeignKey
ALTER TABLE "favorite_list" DROP CONSTRAINT "favorite_list_user_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_agentId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_post_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- DropForeignKey
ALTER TABLE "otp" DROP CONSTRAINT "otp_user_id_fkey";

-- DropForeignKey
ALTER TABLE "post_slugs" DROP CONSTRAINT "post_slugs_post_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_createdById_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_property_id_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_rejectedById_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_district_id_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_province_id_fkey";

-- DropForeignKey
ALTER TABLE "properties" DROP CONSTRAINT "properties_ward_id_fkey";

-- DropForeignKey
ALTER TABLE "property_amenities" DROP CONSTRAINT "property_amenities_amenity_id_fkey";

-- DropForeignKey
ALTER TABLE "property_amenities" DROP CONSTRAINT "property_amenities_property_id_fkey";

-- DropForeignKey
ALTER TABLE "property_images" DROP CONSTRAINT "property_images_property_id_fkey";

-- DropForeignKey
ALTER TABLE "property_utilities" DROP CONSTRAINT "property_utilities_property_id_fkey";

-- DropForeignKey
ALTER TABLE "property_utilities" DROP CONSTRAINT "property_utilities_utility_id_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_post_id_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "roles_permissions" DROP CONSTRAINT "roles_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "roles_permissions" DROP CONSTRAINT "roles_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_searches" DROP CONSTRAINT "saved_searches_user_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";

-- DropForeignKey
ALTER TABLE "utilities" DROP CONSTRAINT "utilities_district_id_fkey";

-- DropForeignKey
ALTER TABLE "utilities" DROP CONSTRAINT "utilities_province_id_fkey";

-- DropForeignKey
ALTER TABLE "utilities" DROP CONSTRAINT "utilities_ward_id_fkey";

-- DropForeignKey
ALTER TABLE "wards" DROP CONSTRAINT "wards_district_id_fkey";

-- DropIndex
DROP INDEX "appointments_agentId_idx";

-- DropIndex
DROP INDEX "appointments_buyerId_idx";

-- DropIndex
DROP INDEX "appointments_scheduledAt_idx";

-- DropIndex
DROP INDEX "audit_logs_entity_entityId_idx";

-- DropIndex
DROP INDEX "conversations_agentId_idx";

-- DropIndex
DROP INDEX "conversations_buyerId_idx";

-- DropIndex
DROP INDEX "conversations_post_id_buyerId_agentId_key";

-- DropIndex
DROP INDEX "deposits_buyerId_idx";

-- DropIndex
DROP INDEX "deposits_sellerId_idx";

-- DropIndex
DROP INDEX "deposits_transactionRef_key";

-- DropIndex
DROP INDEX "leads_agentId_idx";

-- DropIndex
DROP INDEX "leads_buyerId_idx";

-- DropIndex
DROP INDEX "messages_senderId_idx";

-- DropIndex
DROP INDEX "post_slugs_isCurrent_idx";

-- DropIndex
DROP INDEX "posts_createdById_idx";

-- DropIndex
DROP INDEX "posts_postStatus_idx";

-- DropIndex
DROP INDEX "posts_publishedAt_idx";

-- DropIndex
DROP INDEX "property_images_property_id_imageUrl_key";

-- DropIndex
DROP INDEX "reports_reporterId_idx";

-- AlterTable
ALTER TABLE "amenities" DROP CONSTRAINT "amenities_pkey",
DROP COLUMN "amenity_id",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "amenities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_pkey",
DROP COLUMN "agentId",
DROP COLUMN "appointment_id",
DROP COLUMN "buyerId",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "scheduledAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "agent_id" INTEGER,
ADD COLUMN     "buyer_id" INTEGER NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "scheduled_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_pkey",
DROP COLUMN "audit_id",
DROP COLUMN "createdAt",
DROP COLUMN "entityId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entity_id" INTEGER,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_pkey",
DROP COLUMN "agentId",
DROP COLUMN "buyerId",
DROP COLUMN "conversation_id",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "agent_id" INTEGER,
ADD COLUMN     "buyer_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_pkey",
DROP COLUMN "buyerId",
DROP COLUMN "confirmedAt",
DROP COLUMN "createdAt",
DROP COLUMN "deposit_id",
DROP COLUMN "holdExpiresAt",
DROP COLUMN "paidAt",
DROP COLUMN "releasedAt",
DROP COLUMN "sellerId",
DROP COLUMN "transactionRef",
DROP COLUMN "updatedAt",
ADD COLUMN     "buyer_id" INTEGER NOT NULL,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hold_expires_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "seller_id" INTEGER NOT NULL,
ADD COLUMN     "transaction_ref" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "deposits_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "districts" DROP CONSTRAINT "districts_pkey",
DROP COLUMN "district_id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "districts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "favorite_list" DROP CONSTRAINT "favorite_list_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "favorite_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "favorite_list_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "leads" DROP CONSTRAINT "leads_pkey",
DROP COLUMN "agentId",
DROP COLUMN "buyerId",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "lead_id",
DROP COLUMN "updatedAt",
ADD COLUMN     "agent_id" INTEGER,
ADD COLUMN     "buyer_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "log_actions" DROP COLUMN "createdAt",
DROP COLUMN "timeCall",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "time_call" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "messages" DROP CONSTRAINT "messages_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "message_id",
DROP COLUMN "senderId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "sender_id" INTEGER NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "otp" DROP CONSTRAINT "otp_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "expireTime",
DROP COLUMN "otp_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expire_time" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "otp_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "permissions" DROP CONSTRAINT "permissions_pkey",
DROP COLUMN "permission_id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "post_slugs" DROP CONSTRAINT "post_slugs_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "isCurrent",
DROP COLUMN "slug_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT true,
ADD CONSTRAINT "post_slugs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "posts" DROP CONSTRAINT "posts_pkey",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedById",
DROP COLUMN "createdAt",
DROP COLUMN "createdById",
DROP COLUMN "deletedAt",
DROP COLUMN "postContent",
DROP COLUMN "postStatus",
DROP COLUMN "postTitle",
DROP COLUMN "postType",
DROP COLUMN "post_id",
DROP COLUMN "publishedAt",
DROP COLUMN "rejectReason",
DROP COLUMN "rejectedById",
DROP COLUMN "updatedAt",
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" INTEGER,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by_id" INTEGER NOT NULL,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "post_content" TEXT,
ADD COLUMN     "post_status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "post_title" TEXT NOT NULL,
ADD COLUMN     "post_type" "PostType",
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "rejected_by_id" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "properties" DROP CONSTRAINT "properties_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "furnitureStatus",
DROP COLUMN "legalStatus",
DROP COLUMN "property_id",
DROP COLUMN "updatedAt",
DROP COLUMN "yearBuilt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "furniture_status" "FurnitureStatus",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "legal_status" "LegalStatus",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "year_built" INTEGER,
ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "property_amenities" DROP CONSTRAINT "property_amenities_pkey",
DROP COLUMN "deletedAt",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "property_images" DROP CONSTRAINT "property_images_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "imageUrl",
DROP COLUMN "image_id",
DROP COLUMN "isPrimary",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "image_url" TEXT NOT NULL,
ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false,
ADD CONSTRAINT "property_images_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "property_utilities" DROP CONSTRAINT "property_utilities_pkey",
DROP COLUMN "deletedAt",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "property_utilities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "provinces" DROP CONSTRAINT "provinces_pkey",
DROP COLUMN "province_id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reports" DROP CONSTRAINT "reports_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "report_id",
DROP COLUMN "reporterId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "reporter_id" INTEGER,
ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "roles" DROP CONSTRAINT "roles_pkey",
DROP COLUMN "role_id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "saved_searches" DROP CONSTRAINT "saved_searches_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "filtersJson",
DROP COLUMN "notifyEmail",
DROP COLUMN "savedSearch_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "filters_json" JSONB NOT NULL,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "notify_email" BOOLEAN NOT NULL DEFAULT false,
ADD CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "lastLogin",
DROP COLUMN "updatedAt",
DROP COLUMN "user_id",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "utilities" DROP CONSTRAINT "utilities_pkey",
DROP COLUMN "deletedAt",
DROP COLUMN "utility_id",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "utilities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wards" DROP CONSTRAINT "wards_pkey",
DROP COLUMN "ward_id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "wards_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "PasswordResetToken";

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "appointments_buyer_id_idx" ON "appointments"("buyer_id");

-- CreateIndex
CREATE INDEX "appointments_agent_id_idx" ON "appointments"("agent_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "conversations_buyer_id_idx" ON "conversations"("buyer_id");

-- CreateIndex
CREATE INDEX "conversations_agent_id_idx" ON "conversations"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_post_id_buyer_id_agent_id_key" ON "conversations"("post_id", "buyer_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_transaction_ref_key" ON "deposits"("transaction_ref");

-- CreateIndex
CREATE INDEX "deposits_buyer_id_idx" ON "deposits"("buyer_id");

-- CreateIndex
CREATE INDEX "deposits_seller_id_idx" ON "deposits"("seller_id");

-- CreateIndex
CREATE INDEX "leads_buyer_id_idx" ON "leads"("buyer_id");

-- CreateIndex
CREATE INDEX "leads_agent_id_idx" ON "leads"("agent_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "post_slugs_is_current_idx" ON "post_slugs"("is_current");

-- CreateIndex
CREATE INDEX "posts_post_status_idx" ON "posts"("post_status");

-- CreateIndex
CREATE INDEX "posts_created_by_id_idx" ON "posts"("created_by_id");

-- CreateIndex
CREATE INDEX "posts_published_at_idx" ON "posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "property_amenities_property_id_amenity_id_key" ON "property_amenities"("property_id", "amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_images_property_id_image_url_key" ON "property_images"("property_id", "image_url");

-- CreateIndex
CREATE UNIQUE INDEX "property_utilities_property_id_utility_id_key" ON "property_utilities"("property_id", "utility_id");

-- CreateIndex
CREATE INDEX "reports_reporter_id_idx" ON "reports"("reporter_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permissions" ADD CONSTRAINT "roles_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp" ADD CONSTRAINT "otp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_utilities" ADD CONSTRAINT "property_utilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_utilities" ADD CONSTRAINT "property_utilities_utility_id_fkey" FOREIGN KEY ("utility_id") REFERENCES "utilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_list" ADD CONSTRAINT "favorite_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_list" ADD CONSTRAINT "favorite_list_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_slugs" ADD CONSTRAINT "post_slugs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
