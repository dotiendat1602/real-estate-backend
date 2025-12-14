-- AlterTable
ALTER TABLE "deposits" ADD COLUMN     "agent_id" INTEGER;

-- CreateIndex
CREATE INDEX "deposits_agent_id_idx" ON "deposits"("agent_id");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
