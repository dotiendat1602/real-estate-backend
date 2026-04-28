CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "post_embeddings" (
    "id" BIGSERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "chunkIdx" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_embeddings_postId_idx" ON "post_embeddings"("postId");

-- AddForeignKey
ALTER TABLE "post_embeddings" ADD CONSTRAINT "post_embeddings_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
