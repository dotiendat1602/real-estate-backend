/*
  Warnings:

  - Added the required column `updated_at` to the `favorite_list` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "favorite_list" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
