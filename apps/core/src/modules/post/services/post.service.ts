import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllPostsDto } from "../dto/get-all-post.dto";
import { CreatePostDto, UpdatePostDto } from "../dto/create-post.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { PostStatus, Prisma, User } from "@prisma/client";
import { ApiException } from "libs/utils/exception";
import { ItemMessage } from "libs/utils/enum";
import { ContextProvider } from "libs/utils/providers/context.provider";
import { RejectPostDto } from "../dto/reject-post.dto";
import { ReportPostDto } from "../dto/report-post.dto";

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

  async getAllPublicPosts(query: GetAllPostsDto) {
    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      postStatus: PostStatus.APPROVED,
      approvedAt: { not: null },
    }

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      Object.assign(where, {
        postTitle: { contains: q, mode: 'insensitive' },
      });
    }

    if (pagingParams.type) Object.assign(where, { postType: pagingParams.type });

    const [posts, total] = await Promise.all([
      this.prismaService.post.findMany({
        where,
        orderBy,
        skip: pagingParams.skip,
        take: pagingParams.pageSize,
        select: {
          id: true,
          postTitle: true,
          postType: true,
          postContent: true,
          postStatus: true,
          property: {
            select: {
              id: true,
              title: true,
              price: true,
              images: {
                select: {
                  id: true,
                  imageUrl: true,
                  isPrimary: true,
                }
              },
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }),
      this.prismaService.post.count({ where }),
    ]);

    return returnPaging(posts, total, pagingParams);
  }

  async getOnePublicPost(postId: number) {
    const existPost = await this.prismaService.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        postStatus: PostStatus.APPROVED,
        approvedAt: { not: null },
      },
      include: {
        property: {
          include: {
            images: true,
            category: true,
            ward: {
              select: {
                name: true,
              }
            },
            district: {
              select: {
                name: true,
              }
            },
            province: {
              select: {
                name: true,
              }
            },
            propertyAmenities: {
              select: {
                amenity: true,
              }
            },
            propertyUtilities: {
              select: {
                utility: true,
              }
            }
          }
        },
        createdBy: {
          select: {
            name: true,
          }
        },
      }
    });

    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }
    return existPost;
  }

  async getAllPosts(query: GetAllPostsDto) {
    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
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
        id: true,
        postTitle: true,
        postType: true,
        postContent: true,
        postStatus: true,
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            images: {
              select: {
                id: true,
                imageUrl: true,
                isPrimary: true,
              }
            },
          }
        },
        createdBy: {
          select: {
            id: true,
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
        id: postId,
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
    return existPost;
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
            propertyId: dto.propertyId,
            postTitle: dto.postTitle,
            postContent: dto.postContent ?? '',
            postType: dto.postType ?? 'OTHER',
            postStatus: dto.postStatus ?? PostStatus.PENDING,
            createdById: creator.id,
          },
        });

        // optional: AuditLog
        await prisma.auditLog.create({
          data: {
            userId: creator.id,
            action: 'CREATE_POST',
            entity: 'Post',
            entityId: post.id,
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

  async updatePost(postId: number, dto: UpdatePostDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        "UNAUTHORIZED",
        HttpStatus.UNAUTHORIZED,
      )
    }
    const roleOfLoginUser = await this.prismaService.role.findFirst({
      where: {
        id: user.roleId,
      },
      select: {
        name: true,
      }
    });

    const existPost = await this.prismaService.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
    })
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }
    // only admin or creator can update
    const isAdmin = roleOfLoginUser?.name === 'ADMIN';
    const isOwner = existPost.createdById === user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiException(
        'FORBIDDEN: You do not have permission to update this post',
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const updatedPost = await this.prismaService.$transaction(async (prisma) => {
        const post = await prisma.post.update({
          where: { id: postId },
          data: {
            propertyId: dto.propertyId ?? existPost.propertyId,
            postTitle: dto.postTitle ?? existPost.postTitle,
            postContent: dto.postContent ?? existPost.postContent,
            postType: dto.postType ?? existPost.postType,
            postStatus: dto.postStatus ?? existPost.postStatus,
            updatedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'UPDATE_POST',
            entity: 'Post',
            entityId: postId,
            payload: { ...dto },
          },
        });

        return post;
      });

      return updatedPost;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: Post #id${postId}, error ${error.message}`,
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

    const roleOfLoginUser = await this.prismaService.role.findFirst({
      where: {
        id: user.roleId,
      },
      select: {
        name: true,
      }
    });

    const existPost = await this.prismaService.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
    })
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    // only admin or creator can update
    const isAdmin = roleOfLoginUser?.name === 'ADMIN';
    const isOwner = existPost.createdById === user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiException(
        'FORBIDDEN: You do not have permission to update this post',
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      const deletePost = await this.prismaService.$transaction(async (prisma) => {
        // Xử lý các quan hệ N-N

        const deleted = await prisma.post.update({
          where: {
            id: postId,
          },
          data: {
            deletedAt: new Date(),
            publishedAt: null,
          }
        })

        await prisma.auditLog.create({
          data: {
            userId: user.id,
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
        id: postId,
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
          where: { id: postId },
          data: { deletedAt: null, updatedAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
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
        id: postId,
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
          where: { id: postId },
          data: {
            approvedById: user.id,
            approvedAt: new Date(),
            rejectedById: null,
            rejectReason: null,
            postStatus: PostStatus.APPROVED,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
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
        id: postId,
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
          where: { id: postId },
          data: {
            rejectedById: user.id,
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
            userId: user.id,
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

  async archivePost(postId: number) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) throw new ApiException('UNAUTHORIZED USER', HttpStatus.UNAUTHORIZED);

    const existPost = await this.prismaService.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      }
    });
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const archived = await this.prismaService.$transaction(async (prisma) => {
        const updated = await prisma.post.update({
          where: { id: postId },
          data: {
            postStatus: PostStatus.ARCHIVED,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'ARCHIVE_POST',
            entity: 'Post',
            entityId: postId,
          },
        });

        return updated;
      });
      return archived;
    } catch (error) {
      throw new ApiException(
        `Error while archiving post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async reportPost(postId: number, dto: ReportPostDto) {
    const existPost = await this.prismaService.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      }
    });
    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    if (dto.reporterId) {
      const reporter = await this.prismaService.user.findFirst({
        where: {
          id: dto.reporterId,
          deletedAt: null,
        }
      });
      if (!reporter) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: User #id${dto.reporterId}`,
          HttpStatus.NOT_FOUND,
        )
      }
    }

    try {
      const report = await this.prismaService.report.create({
        data: {
          postId: postId,
          reporterId: dto.reporterId ?? null,
          reason: dto.reason,
        }
      });
      return report;
    }
    catch (error) {
      throw new ApiException(
        `Error while reporting post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
