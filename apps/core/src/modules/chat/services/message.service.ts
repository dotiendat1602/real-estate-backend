import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { ConversationService } from './conversation.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { SendBuyerMessageDto } from '../dto/send-buyer-message.dto';
import { SendManagerReplyAsAgentDto } from '../dto/send-manager-reply-as-agent.dto';
import { Message, Prisma, RoleType, User } from '@prisma/client';
import { SocketGateway } from 'apps/core/src/socket/socket.gateway';
import { MessageSocket } from 'libs/utils/enum';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { GetAllMessagesOfConversationDto } from '../dto/get-all-messages-conversation.dto';
import { SendMessageChatBotDto } from '../dto/send-message-chat-bot.dto';
import { AIChatRequest, AIChatResponse } from 'libs/utils/constant';
import { AIClientService } from './ai-client.service';

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly socketGateway: SocketGateway,
    private readonly conversationService: ConversationService,
    private readonly aiClientService: AIClientService,
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

  /**
   * Chat với AI bot để tư vấn bất động sản
   * - Gọi AI service qua HTTP
   * - Trả về answer + danh sách posts liên quan (citations)
   */
  async sendMessageChatBot(body: SendMessageChatBotDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    this.logger.log(`User ${user.id} is chatting with AI bot: "${body.message}"`);

    const aiRequest: AIChatRequest = {
      userId: user.id,
      message: body.message.trim(),
      sessionId: user.aiChatSessionId ?? undefined,
      postId: body.postId,
    };

    let conversationWithBot;
    let userMessageId: number | null = null;

    try {
      // Tìm hoặc tạo conversation AI bot cho user
      conversationWithBot = await this.prismaService.chatBotConversation.findFirst({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (!conversationWithBot) {
        this.logger.log(`Creating new AI bot conversation for user ${user.id}`);
        conversationWithBot = await this.prismaService.chatBotConversation.create({
          data: {
            userId: user.id,
            lastMessageAt: new Date(),
          },
        });

        await this.prismaService.chatBotMessage.create({
          data: {
            chatbotConversationId: conversationWithBot.id,
            senderType: 'CHATBOT',
            content: 'Hello! How can I assist you with your real estate needs today?',
          },
        });
      }

      const userMessage = await this.prismaService.chatBotMessage.create({
        data: {
          chatbotConversationId: conversationWithBot.id,
          senderType: 'USER',
          content: body.message.trim(),
        },
      });
      userMessageId = userMessage.id;

      const aiResponse: AIChatResponse = await this.aiClientService.chat(aiRequest);

      this.logger.log(`AI bot responded to user ${user.id} with ${aiResponse.citations.length} citations`);

      await this.prismaService.user.update({
        where: { id: user.id },
        data: { aiChatSessionId: aiResponse.sessionId },
      });

      // Enrich citations với thông tin post từ DB
      const postIds = aiResponse.citations
        .map(c => c.postId)
        .filter((id): id is number => typeof id === 'number');

      let enrichedCitations = aiResponse.citations;

      if (postIds.length > 0) {
        const posts = await this.prismaService.post.findMany({
          where: {
            id: { in: postIds },
            deletedAt: null,
            postStatus: 'APPROVED',
          },
          select: {
            id: true,
            postTitle: true,
            postType: true,
            property: {
              select: {
                images: {
                  select: {
                    imageUrl: true,
                  },
                  orderBy: [
                    { isPrimary: 'desc' },
                    { createdAt: 'desc' },
                  ],
                  take: 1,
                },
                price: true,
                area: true,
                location: true,
                province: {
                  select: { name: true },
                },
                district: {
                  select: { name: true },
                },
                ward: {
                  select: { name: true },
                },
                bedroomNumber: true,
              },
            },
          },
        });

        const postMap = new Map(posts.map(p => [p.id, p]));

        enrichedCitations = aiResponse.citations.map(citation => {
          const post = citation.postId ? postMap.get(citation.postId) : null;
          if (post) {
            const postProperty = (post as any).property;
            return {
              ...citation,
              postTitle: post.postTitle,
              postType: post.postType,
              imageUrl: postProperty?.images?.[0]?.imageUrl ?? null,
              price: postProperty?.price,
              area: postProperty?.area,
              location: postProperty?.location,
              province: postProperty?.province?.name,
              district: postProperty?.district?.name,
              ward: postProperty?.ward?.name,
              bedrooms: postProperty?.bedroomNumber,
            };
          }
          return citation.postId ? null : citation;
        }).filter((citation): citation is NonNullable<typeof citation> => citation !== null);
      }

      const citationsJson = toJsonValue(
        enrichedCitations.map((c) => ({
          ...c,

          postId: c.postId ?? null,
          chunkIndex: (c as any).chunkIndex ?? null,
          score: (c as any).score ?? null,

          postTitle: (c as any).postTitle ?? null,
          postType: (c as any).postType ?? null,
          price: (c as any).price ?? null,
          area: (c as any).area ?? null,
          location: (c as any).location ?? null,
          province: (c as any).province ?? null,
          district: (c as any).district ?? null,
          ward: (c as any).ward ?? null,
          bedrooms: (c as any).bedrooms ?? null,
        }))
      ) as Prisma.InputJsonValue;

      const botMessage = await this.prismaService.chatBotMessage.create({
        data: {
          chatbotConversationId: conversationWithBot.id,
          senderType: 'CHATBOT',
          content: aiResponse.answer,
          metadata: {
            citations: citationsJson,
            citationCount: enrichedCitations.length,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.chatBotConversation.update({
        where: { id: conversationWithBot.id },
        data: { lastMessageAt: new Date() },
      });

      return {
        conversationId: conversationWithBot.id,
        userMessageId: userMessage.id,
        botMessageId: botMessage.id,
        answer: aiResponse.answer,
        citations: enrichedCitations,
        metadata: {
          userId: user.id,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get AI response for user ${user.id}: ${error.message}`,
        error.stack,
      );

      if (conversationWithBot && userMessageId) {
        const fallbackAnswer =
          'Xin lỗi, hệ thống AI đang phản hồi chậm nên tôi chưa thể phân tích đầy đủ câu hỏi này. ' +
          'Tôi đã lưu lại câu hỏi của bạn trong cuộc trò chuyện. Bạn vui lòng thử gửi lại sau ít phút; ' +
          'nếu đây là câu hỏi về quy hoạch, hãy kiểm tra thêm phần dẫn chứng/hồ sơ quy hoạch trên trang chi tiết trước khi ra quyết định.';

        const botMessage = await this.prismaService.chatBotMessage.create({
          data: {
            chatbotConversationId: conversationWithBot.id,
            senderType: 'CHATBOT',
            content: fallbackAnswer,
            metadata: {
              citations: [],
              citationCount: 0,
              fallback: true,
              fallbackReason: 'AI_SERVICE_UNAVAILABLE',
              originalError: error?.message || 'AI service unavailable',
            } as Prisma.InputJsonValue,
          },
        });

        await this.prismaService.chatBotConversation.update({
          where: { id: conversationWithBot.id },
          data: { lastMessageAt: new Date() },
        });

        return {
          conversationId: conversationWithBot.id,
          userMessageId,
          botMessageId: botMessage.id,
          answer: fallbackAnswer,
          citations: [],
          metadata: {
            userId: user.id,
            timestamp: botMessage.createdAt.toISOString(),
            fallback: true,
            fallbackReason: 'AI_SERVICE_UNAVAILABLE',
          },
        };
      }

      throw error;
    }
  }

  async getChatBotMessages(query: GetAllMessagesOfConversationDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    let conversationWithBot = await this.prismaService.chatBotConversation.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversationWithBot) {
      conversationWithBot = await this.prismaService.chatBotConversation.create({
        data: {
          userId: user.id,
          lastMessageAt: new Date(),
        },
      });
      await this.prismaService.chatBotMessage.create({
        data: {
          chatbotConversationId: conversationWithBot.id,
          senderType: 'CHATBOT',
          content: 'Hello! How can I assist you with your real estate needs today?',
        },
      });
    }

    const pagingMessages = assignPaging(query);

    const where: Prisma.ChatBotMessageWhereInput = {
      chatbotConversationId: conversationWithBot.id,
      deletedAt: null,
    };

    const [messages, total] = await Promise.all([
      this.prismaService.chatBotMessage.findMany({
        where,
        skip: pagingMessages.skip,
        take: pagingMessages.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.chatBotMessage.count({
        where,
      }),
    ]);

    return returnPaging(messages, total, pagingMessages);
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
