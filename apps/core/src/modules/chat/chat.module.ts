import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { MessageService } from './services/message.service';
import { ConversationService } from './services/conversation.service';
import { AIClientService } from './services/ai-client.service';
import { HttpModule } from '@nestjs/axios';
import { PlanningModule } from '../planning/planning.module';

@Module({
  imports: [HttpModule, PlanningModule],
  controllers: [ChatController],
  providers: [MessageService, ConversationService, AIClientService],
  exports: [MessageService, ConversationService, AIClientService],
})
export class ChatModule { }
