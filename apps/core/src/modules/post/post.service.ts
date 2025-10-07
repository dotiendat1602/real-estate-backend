import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllPostsDto } from "./dto/get-all-post.dto";
import { CreatePostDto } from "./dto/create-post.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { PostStatus, Prisma, User } from "@prisma/client";
import { ApiException } from "libs/utils/exception";
import { ItemMessage } from "libs/utils/enum";
import { ContextProvider } from "libs/utils/providers/context.provider";
import { RejectPostDto } from "./dto/reject-post.dto";

const SORT_WHITELIST: Record<string, keyof Prisma.PostOrderByWithRelationInput> = {
  postTitle: 'postTitle',
  postStatus: 'postStatus',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

@Injectable()
export class PostService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  private ensureSort(orderKey?: string, sortOrder?: 'asc' | 'desc') {
    const key = orderKey && SORT_WHITELIST[orderKey] ? SORT_WHITELIST[orderKey] : 'createdAt';
    const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';
    return { [key]: order } as Prisma.PostOrderByWithRelationInput;
  }

  async getAllPosts(query: GetAllPostsDto) {
    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
    }

    const mode = (pagingParams.mode?.toUpperCase());
    switch (mode) {
      case 'PENDING':
        Object.assign(where, { approvedAt: null, rejectedById: null });
        break;
      case 'APPROVED':
        Object.assign(where, { approvedAt: { not: null } });
        break;
      case 'REJECTED':
        Object.assign(where, { rejectedById: { not: null } });
        break;
      default:
        break;
    }

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      Object.assign(where, {
        postTitle: { contains: q, mode: 'insensitive' },
      });
    }

    if (pagingParams.type) Object.assign(where, { postType: pagingParams.type });
    if (pagingParams.status) Object.assign(where, { postStatus: pagingParams.status });

    const posts = await this.prismaService.post.findMany({
      where,
      orderBy,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        post_id: true,
        postTitle: true,
        postType: true,
        postContent: true,
        postStatus: true,
        property: {
          select: {
            property_id: true,
            title: true,
            price: true,
            images: true,
          }
        },
        createdBy: {
          select: {
            user_id: true,
            name: true,
          }
        }
      }
    })
    const total = await this.prismaService.post.count({ where });

    return returnPaging(posts, total, pagingParams);
  }

  async getOnePost(postId: number) {
    const existPost = await this.prismaService.post.findFirst({
      where: {
        post_id: postId,
        deletedAt: null,
      },
      include: {
        property: true,
        createdBy: {
          select: {
            name: true,
          }
        },
        approvedBy: {
          select: {
            name: true,
          }
        },
        rejectedBy: {
          select: {
            name: true,
          }
        },
        deposits: true,
        reports: true,
      }
    })
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }
  }

  async createPost(dto: CreatePostDto) {
    const creator = ContextProvider.getAuthUser<User>();
    if (!creator) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }
    try {
      const newPost = await this.prismaService.$transaction(async (prisma) => {
        const post = await prisma.post.create({
          data: {
            property_id: dto.property_id,
            postTitle: dto.postTitle,
            postContent: dto.postContent ?? '',
            postType: dto.postType ?? 'OTHER',
            postStatus: dto.postStatus ?? PostStatus.PENDING,
            createdById: creator.user_id,
          },
        });

        // optional: AuditLog
        await prisma.auditLog.create({
          data: {
            user_id: creator.user_id,
            action: 'CREATE_POST',
            entity: 'Post',
            entityId: post.post_id,
            payload: { ...dto },
          },
        });

        return post;
      });

      return newPost;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async deletePost(postId: number) {
    const user: User = ContextProvider.getAuthUser();
    if (!user) {
      throw new ApiException(
        "UNAUTHORIZED USER",
        HttpStatus.UNAUTHORIZED,
      )
    }
    const existPost = await this.prismaService.post.findFirst({
      where: {
        post_id: postId,
        deletedAt: null,
      },
    })
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const deletePost = await this.prismaService.$transaction(async (prisma) => {
        // Xử lý các quan hệ N-N

        const deleted = await prisma.post.update({
          where: {
            post_id: postId,
          },
          data: {
            deletedAt: new Date(),
          }
        })

        await prisma.auditLog.create({
          data: {
            user_id: user.user_id,
            action: 'SOFT_DELETE_POST',
            entity: 'Post',
            entityId: postId,
          },
        });

        return deleted;
      })
      return deletePost;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: Post #id${postId} and error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async restorePost(postId: number) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        "UNAUTHORIZED USER",
        HttpStatus.UNAUTHORIZED,
      )
    }

    const existDeletedPost = await this.prismaService.post.findFirst({
      where: {
        post_id: postId,
        deletedAt: { not: null }
      }
    })
    if (!existDeletedPost) {
      throw new ApiException(
        `Post #id${postId} has not been deleted or not exist`,
        HttpStatus.NOT_FOUND,
      )
    }
    try {
      const restored = await this.prismaService.$transaction(async (prisma) => {
        const post = await prisma.post.update({
          where: { post_id: postId },
          data: { deletedAt: null, updatedAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            user_id: user.user_id,
            action: 'RESTORE_POST',
            entity: 'Post',
            entityId: postId,
          },
        });

        return post;
      });

      return restored;
    } catch (error) {
      throw new ApiException(
        `Post #id${postId} cann't be restored: error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async approvePost(postId: number) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) throw new ApiException('UNAUTHORIZED USER', HttpStatus.UNAUTHORIZED);

    const existPost = await this.prismaService.post.findFirst({
      where: {
        post_id: postId,
        deletedAt: null,
      },
    })
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const approved = await this.prismaService.$transaction(async (prisma) => {
        const updated = await prisma.post.update({
          where: { post_id: postId },
          data: {
            approvedById: user.user_id,
            approvedAt: new Date(),
            rejectedById: null,
            rejectReason: null,
            postStatus: PostStatus.PENDING,
          },
        });

        await prisma.auditLog.create({
          data: {
            user_id: user.user_id,
            action: 'APPROVE_POST',
            entity: 'Post',
            entityId: postId,
          },
        });

        return updated;
      });
      return approved;
    } catch (error) {
      throw new ApiException(
        `Error while approving post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async rejectPost(postId: number, dto: RejectPostDto) {
    const user: User = ContextProvider.getAuthUser();
    if (!user) throw new ApiException('UNAUTHORIZED USER', HttpStatus.UNAUTHORIZED);

    const existPost = await this.prismaService.post.findFirst({
      where: {
        post_id: postId,
        deletedAt: null,
      },
    })
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const rejected = await this.prismaService.$transaction(async (prisma) => {
        const updated = await prisma.post.update({
          where: { post_id: postId },
          data: {
            rejectedById: user.user_id,
            rejectReason: dto.rejectReason ?? '',
            approvedById: null,
            approvedAt: null,
            publishedAt: null,
            postStatus: PostStatus.REJECTED,
            updatedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            user_id: user.user_id,
            action: 'REJECT_POST',
            entity: 'Post',
            entityId: postId,
            payload: { reason: dto.rejectReason ?? '' },
          },
        });

        return updated;
      });

      return rejected;
    } catch (error) {
      throw new ApiException(
        `Error while rejecting post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}