// src/modules/chat/services/conversation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { Conversation, Prisma } from '@prisma/client';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { GetAllConversationsDto } from '../dto/get-all-conversations.dto';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) { }

  private SORT_WHITELIST: Record<string, keyof Prisma.ConversationOrderByWithRelationInput> = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  };

  private ensureSort(orderKey?: string, sortOrder?: 'asc' | 'desc') {
    const key = orderKey && this.SORT_WHITELIST[orderKey] ? this.SORT_WHITELIST[orderKey] : 'createdAt';
    const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';
    return { [key]: order } as Prisma.ConversationOrderByWithRelationInput;
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
      where.post_id = paging.postId;
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
        orderBy: orderBy,
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
        post_id: postId,
        buyerId,
        agentId,
        deletedAt: null,
      },
    });

    if (existing) return existing;

    const conversation = await this.prisma.conversation.create({
      data: {
        post_id: postId,
        buyerId,
        agentId,
      },
    });

    return conversation;
  }

  async getById(conversationId: number) {
    return this.prisma.conversation.findFirst({
      where: { conversation_id: conversationId, deletedAt: null },
    });
  }
}
