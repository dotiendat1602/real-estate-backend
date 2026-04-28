/*
  Warnings:

  - You are about to drop the column `sellerId` on the `appointments` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "RoleType" ADD VALUE 'AGENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemPermissionType" ADD VALUE 'MANAGE_LEADS';
ALTER TYPE "SystemPermissionType" ADD VALUE 'MANAGE_CHAT';
ALTER TYPE "SystemPermissionType" ADD VALUE 'MANAGE_APPOINTMENT';

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_sellerId_fkey";

-- DropIndex
DROP INDEX "appointments_sellerId_idx";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "sellerId",
ADD COLUMN     "agentId" INTEGER;

-- CreateIndex
CREATE INDEX "appointments_agentId_idx" ON "appointments"("agentId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
