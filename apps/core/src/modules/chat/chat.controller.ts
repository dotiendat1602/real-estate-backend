// src/modules/chat/chat.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { MessageService } from './services/message.service';
import { ConversationService } from './services/conversation.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { SendBuyerMessageDto } from './dto/send-buyer-message.dto';
import { SendManagerReplyAsAgentDto } from './dto/send-manager-reply-as-agent.dto';
import { Auth } from 'libs/utils';
import { GetAllConversationsDto } from './dto/get-all-conversations.dto';
import { GetAllMessagesOfConversationDto } from './dto/get-all-messages-conversation.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
  ) { }

  @Auth()
  @Get('conversations')
  async getAllConversations(
    @Query() query: GetAllConversationsDto,
  ) {
    return await this.conversationService.getAllConversations(query);
  }

  /**
   * Buyer nhắn cho 1 post + 1 agent
   * -> auto create/get conversation + tạo message
   * Body: { postId, buyerId, agentId, content }
   * (sau này có thể bỏ buyerId và lấy từ token)
   */
  @Auth()
  @Post('buyer/send-first-message')
  async sendBuyerFirstMessage(@Body() body: SendBuyerMessageDto) {
    return this.messageService.sendBuyerMessage(body);
  }

  /**
   * Gửi message trong conversation đã có
   * - dùng cho cả buyer & agent (dựa vào user đang login)
   */
  @Auth()
  @Post('conversations/:conversationId/messages')
  async sendMessageInConversation(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body() body: CreateMessageDto,
  ) {
    return this.messageService.sendMessageInConversation(conversationId, body);
  }

  /**
   * Manager reply as agent trong conversation
   */
  @Post('conversations/:conversationId/reply-as-agent')
  async managerReplyAsAgent(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body() body: SendManagerReplyAsAgentDto,
  ) {
    return this.messageService.sendManagerReplyAsAgent(conversationId, body);
  }

  /**
   * Lấy danh sách message của 1 conversation
   */
  @Get('conversations/:conversationId/messages')
  async getAllMessagesOfConversation(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query() query: GetAllMessagesOfConversationDto,
  ) {
    return this.messageService.getMessagesOfConversation(conversationId, query);
  }

  /**
   * Lấy thông tin conversation
   */
  @Get('conversations/:conversationId')
  async getConversation(
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ) {
    return this.conversationService.getById(conversationId);
  }
}
