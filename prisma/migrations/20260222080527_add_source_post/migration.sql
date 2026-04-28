-- CreateEnum
CREATE TYPE "PostSource" AS ENUM ('BATDONGSAN', 'ESTATEIN', 'OTHER');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "source" "PostSource",
ADD COLUMN     "source_uid" TEXT,
ADD COLUMN     "source_url" TEXT;
