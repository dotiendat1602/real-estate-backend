// src/modules/chat/services/message.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { ConversationService } from './conversation.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { SendBuyerMessageDto } from '../dto/send-buyer-message.dto';
import { SendManagerReplyAsAgentDto } from '../dto/send-manager-reply-as-agent.dto';
import { Conversation, Message, RoleType, User } from '@prisma/client';
import { SocketGateway } from 'apps/core/src/socket/socket.gateway';
import { MessageSocket } from 'libs/utils/enum';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { GetAllMessagesOfConversationDto } from '../dto/get-all-messages-conversation.dto';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketGateway: SocketGateway,
    private readonly conversationService: ConversationService,
  ) { }

  /**
   * Gửi message trong conversation đã có
   * - sử dụng user đang login (ContextProvider)
   * - dùng chung cho buyer & agent
   */
  async sendMessageInConversation(
    conversationId: number,
    dto: CreateMessageDto,
  ): Promise<Message> {
    const currentUser: User = ContextProvider.getAuthUser();
    if (!currentUser) {
      throw new ForbiddenException('Unauthenticated');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        conversation_id: conversationId,
        deletedAt: null,
      },
      select: {
        conversation_id: true,
        buyerId: true,
        agentId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const { buyerId, agentId } = conversation;
    const isBuyer = buyerId != null && buyerId === currentUser.user_id;
    const isAgent = agentId != null && agentId === currentUser.user_id;

    if (!isBuyer && !isAgent) {
      throw new ForbiddenException(
        'User is not a participant of this conversation',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        conversation_id: conversation.conversation_id,
        senderId: currentUser.user_id,
        content: dto.content,
      },
    });

    const socketMessage = this.mapToSocketMessage(message);
    this.socketGateway.broadcastNewMessage(socketMessage);

    return message;
  }

  /**
   * Buyer nhắn lần đầu (hoặc tiếp tục) vào 1 post + 1 agent
   * -> auto create/get conversation
   */
  async sendBuyerMessage(
    dto: SendBuyerMessageDto,
  ) {
    const buyer: User = ContextProvider.getAuthUser();
    const conversation =
      await this.conversationService.createOrGetConversation(
        dto.postId,
        buyer.user_id,
        dto.agentId,
      );

    const message = await this.prisma.message.create({
      data: {
        conversation_id: conversation.conversation_id,
        senderId: buyer.user_id,
        content: dto.content,
      },
    });

    const socketMessage = this.mapToSocketMessage(message);
    this.socketGateway.broadcastNewMessage(socketMessage);

    return { conversation, message };
  }

  /**
   * Manager reply "as agent":
   * - senderId trong Message vẫn là agentId để buyer thấy agent trả lời.
   */
  async sendManagerReplyAsAgent(
    conversationId: number,
    dto: SendManagerReplyAsAgentDto,
  ) {
    const manager: User = ContextProvider.getAuthUser();
    if (!manager) {
      throw new ForbiddenException('Unauthorized');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        conversation_id: conversationId,
        deletedAt: null,
      },
      select: {
        conversation_id: true,
        post_id: true,
        buyerId: true,
        agentId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.agentId) {
      throw new ForbiddenException(
        'This conversation does not have an agent assigned',
      );
    }

    const managerRole = await this.prisma.role.findUnique({
      where: {
        role_id: manager.role_id,
      },
      select: {
        name: true,
      },
    });

    if (!managerRole) {
      throw new NotFoundException('Manager role not found');
    }
    if (
      managerRole.name !== RoleType.MANAGER &&
      managerRole.name !== RoleType.ADMIN
    ) {
      throw new ForbiddenException(
        'User does not have manager or admin role',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        conversation_id: conversation.conversation_id,
        senderId: conversation.agentId,
        content: dto.content,
      },
    });

    const socketMessage = this.mapToSocketMessage(message);
    this.socketGateway.broadcastNewMessage(socketMessage);

    return { conversation, message };
  }

  async getMessagesOfConversation(conversationId: number, query: GetAllMessagesOfConversationDto) {
    const paging = assignPaging(query);

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          conversation_id: conversationId,
          deletedAt: null,
        },
        skip: paging.skip,
        take: paging.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.message.count({ where: { conversation_id: conversationId, deletedAt: null } }),
    ]);

    return returnPaging(messages, total, paging);
  }

  // ---------------------------------------------------------------------------
  // Helper
  // ---------------------------------------------------------------------------
  private mapToSocketMessage(message: Message): MessageSocket {
    return {
      message_id: message.message_id,
      conversation_id: message.conversation_id,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
