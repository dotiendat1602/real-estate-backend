import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { MessageService } from './services/message.service';
import { ConversationService } from './services/conversation.service';

@Module({
  controllers: [ChatController],
  providers: [MessageService, ConversationService],
  exports: [MessageService, ConversationService],
})
export class ChatModule { }
