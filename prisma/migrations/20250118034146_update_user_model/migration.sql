/*
  Warnings:

  - You are about to drop the column `payloadCell` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `pointCurrent` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `userName` on the `users` table. All the data in the column will be lost.
  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "payloadCell",
DROP COLUMN "pointCurrent",
DROP COLUMN "userName",
ADD COLUMN     "name" VARCHAR(255) NOT NULL,
ADD COLUMN     "password" VARCHAR(255) NOT NULL;
