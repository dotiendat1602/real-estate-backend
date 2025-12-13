import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { Conversation, Prisma, User } from '@prisma/client';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { GetAllConversationsDto } from '../dto/get-all-conversations.dto';
import { ContextProvider } from 'libs/utils/providers/context.provider';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) { }

  private SORT_WHITELIST: Record<string, keyof Prisma.ConversationOrderByWithRelationInput> = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    lastMessageAt: 'lastMessageAt',
  };

  private ensureSort(
    orderKey?: string,
    sortOrder?: 'asc' | 'desc',
  ): Prisma.ConversationOrderByWithRelationInput[] {
    const key =
      orderKey && this.SORT_WHITELIST[orderKey]
        ? this.SORT_WHITELIST[orderKey]
        : 'createdAt';

    const order: Prisma.SortOrder =
      sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';

    const nulls: Prisma.NullsOrder = 'last';

    const lastMessageAtOrder: Prisma.ConversationOrderByWithRelationInput = {
      lastMessageAt: { sort: 'desc', nulls },
    };

    if (key === 'lastMessageAt') {
      return [
        {
          lastMessageAt: { sort: order, nulls },
        } as Prisma.ConversationOrderByWithRelationInput,
      ];
    }

    const secondary: Prisma.ConversationOrderByWithRelationInput = {
      [key]: { sort: order },
    } as Prisma.ConversationOrderByWithRelationInput;

    return [lastMessageAtOrder, secondary];
  }

  async getAllConversations(query: GetAllConversationsDto) {
    const paging = assignPaging(query);

    const orderBy = this.ensureSort(query.sortKey, query.sortOrder);

    const where: Prisma.ConversationWhereInput = {
      deletedAt: null,
    }

    if (paging.search) {
      const keyword = paging.search.trim();
      where.OR = [
        {
          post: {
            postTitle: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        },
        {
          buyer: {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        },
        {
          agent: {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (paging.postId) {
      where.postId = paging.postId;
    }

    if (paging.buyerId) {
      where.buyerId = paging.buyerId;
    }

    if (paging.agentId) {
      where.agentId = paging.agentId;
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: paging.skip,
        take: paging.take,
        orderBy,
        include: {
          post: true,
          buyer: true,
          agent: true,
          // last message
          messages: {
            where: {
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return returnPaging(conversations, total, paging);
  }

  /**
   * Đảm bảo 1 buyer - 1 post - 1 agent chỉ có 1 conversation
   */
  async createOrGetConversation(
    postId: number,
    buyerId: number,
    agentId: number,
  ): Promise<Conversation> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        postId: postId,
        buyerId,
        agentId,
        deletedAt: null,
      },
    });

    if (existing) return existing;

    const conversation = await this.prisma.conversation.create({
      data: {
        postId: postId,
        buyerId,
        agentId,
      },
    });

    return conversation;
  }

  async getById(conversationId: number) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
  }

  async getUserConversations(query: GetAllConversationsDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }
    const paging = assignPaging(query);

    const orderBy = this.ensureSort(query.sortKey, query.sortOrder);

    const where: Prisma.ConversationWhereInput = {
      deletedAt: null,
      buyerId: user.id,
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: paging.skip,
        take: paging.take,
        orderBy,
        include: {
          post: true,
          buyer: true,
          agent: true,
          // last message
          messages: {
            where: {
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return returnPaging(conversations, total, paging);
  }
}
