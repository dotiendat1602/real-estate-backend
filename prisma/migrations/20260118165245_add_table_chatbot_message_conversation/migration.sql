-- CreateEnum
CREATE TYPE "ChatParticipantType" AS ENUM ('USER', 'CHATBOT');

-- CreateTable
CREATE TABLE "chatbot_conversations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_messages" (
    "id" SERIAL NOT NULL,
    "chatbot_conversation_id" INTEGER NOT NULL,
    "sender_type" "ChatParticipantType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatbot_conversations_user_id_idx" ON "chatbot_conversations"("user_id");

-- CreateIndex
CREATE INDEX "chatbot_messages_chatbot_conversation_id_idx" ON "chatbot_messages"("chatbot_conversation_id");

-- CreateIndex
CREATE INDEX "chatbot_messages_sender_type_idx" ON "chatbot_messages"("sender_type");

-- AddForeignKey
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_chatbot_conversation_id_fkey" FOREIGN KEY ("chatbot_conversation_id") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
