-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "created_by_id" INTEGER,
ALTER COLUMN "owner_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
