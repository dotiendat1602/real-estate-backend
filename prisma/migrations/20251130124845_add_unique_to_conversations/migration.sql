/*
  Warnings:

  - A unique constraint covering the columns `[post_id,buyerId,agentId]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "conversations_post_id_buyerId_agentId_key" ON "conversations"("post_id", "buyerId", "agentId");
