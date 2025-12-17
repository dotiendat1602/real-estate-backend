import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
import { SendMessageChatBotDto } from '../dto/send-message-chat-bot.dto';

@Injectable()
export class MessageService {
  constructor(
    private readonly prismaService: PrismaService,
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

    const conversation = await this.prismaService.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        buyerId: true,
        agentId: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const { buyerId, agentId } = conversation;
    const isBuyer = buyerId != null && buyerId === currentUser.id;
    const isAgent = agentId != null && agentId === currentUser.id;

    if (!isBuyer && !isAgent) {
      throw new ForbiddenException(
        'User is not a participant of this conversation',
      );
    }

    const send = await this.prismaService.$transaction(async (prisma) => {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: currentUser.id,
          content: dto.content,
        },
      });

      const updatedConversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });

      const socketMessage = this.mapToSocketMessage(message);
      this.socketGateway.broadcastNewMessage(socketMessage);

      return message;
    });

    return send;
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
        buyer.id,
        dto.agentId,
      );

    const send = await this.prismaService.$transaction(async (prisma) => {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: buyer.id,
          content: dto.content,
        },
      });

      const updatedConversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });

      const socketMessage = this.mapToSocketMessage(message);
      this.socketGateway.broadcastNewMessage(socketMessage);

      return message;
    });

    return { conversation, send };
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

    const conversation = await this.prismaService.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        postId: true,
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

    const agentId: number = conversation.agentId;

    const managerRole = await this.prismaService.role.findUnique({
      where: {
        id: manager.roleId,
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

    const send = await this.prismaService.$transaction(async (prisma) => {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: agentId,
          content: dto.content,
        },
      });

      const updatedConversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });

      const socketMessage = this.mapToSocketMessage(message);
      this.socketGateway.broadcastNewMessage(socketMessage);

      return message;
    });

    return { conversation, send };
  }

  async getMessagesOfConversation(conversationId: number, query: GetAllMessagesOfConversationDto) {
    const paging = assignPaging(query);

    const conversation = await this.conversationService.getById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const [messages, total] = await Promise.all([
      this.prismaService.message.findMany({
        where: {
          conversationId: conversationId,
          deletedAt: null,
        },
        skip: paging.skip,
        take: paging.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prismaService.message.count({ where: { conversationId: conversationId, deletedAt: null } }),
    ]);

    return returnPaging(messages, total, paging);
  }

  async getUserConversationMessages(conversationId: number, query: GetAllMessagesOfConversationDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const conversation = await this.conversationService.getById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.buyerId !== user.id && conversation.agentId !== user.id) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const paging = assignPaging(query);

    const [messages, total] = await Promise.all([
      this.prismaService.message.findMany({
        where: {
          conversationId: conversationId,
          deletedAt: null,
        },
        skip: paging.skip,
        take: paging.take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prismaService.message.count({ where: { conversationId: conversationId, deletedAt: null } }),
    ]);

    return returnPaging(messages, total, paging);
  }

  async sendMessageChatBot(body: SendMessageChatBotDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }


  }

  // ---------------------------------------------------------------------------
  // Helper
  // ---------------------------------------------------------------------------
  private mapToSocketMessage(message: Message): MessageSocket {
    return {
      message_id: message.id,
      conversation_id: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
