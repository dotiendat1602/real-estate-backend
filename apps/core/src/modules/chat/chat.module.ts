import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { MessageService } from './services/message.service';
import { ConversationService } from './services/conversation.service';
import { AIClientService } from './services/ai-client.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [ChatController],
  providers: [MessageService, ConversationService, AIClientService],
  exports: [MessageService, ConversationService, AIClientService],
})
export class ChatModule { }
