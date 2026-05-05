import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllPostsDto } from "../dto/get-all-post.dto";
import { CreatePostDto, UpdatePostDto } from "../dto/create-post.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { PostStatus, Prisma, RoleType, Status, User } from "@prisma/client";
import { ApiException } from "libs/utils/exception";
import { ItemMessage } from "libs/utils/enum";
import { ContextProvider } from "libs/utils/providers/context.provider";
import { RejectPostDto } from "../dto/reject-post.dto";
import { ReportPostDto, UpdateReportDto } from "../dto/report-post.dto";
import { CoreConfigService } from "../../config/core-config.service";
import { GetAllReportDto } from "../dto/get-all-report.dto";
import { PostIngestJobData, PostIngestQueueService } from "./post-ingest-queue.service";
import { BatchApprovePostDto } from "../dto/batch-approve-post.dto";

const SORT_WHITELIST: Record<string, keyof Prisma.PostOrderByWithRelationInput> = {
  postTitle: 'postTitle',
  postStatus: 'postStatus',
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: CoreConfigService,
    private readonly postIngestQueueService: PostIngestQueueService,
  ) { }

  private async ingestPostToAI(postId: number) {
    try {
      const aiServiceUrl = this.configService.aiService.url || 'http://127.0.0.1:8001';

      const post = await this.prismaService.post.findFirst({
        where: { id: postId },
        include: {
          property: {
            include: {
              category: { select: { categoryName: true } },
              province: { select: { name: true } },
              district: { select: { name: true } },
              ward: { select: { name: true } },
              propertyAmenities: {
                select: { amenity: { select: { name: true } } }
              },
              propertyUtilities: {
                select: {
                  distanceM: true,
                  travelTimeS: true,
                  utility: { select: { utilityName: true } }
                }
              }
            }
          }
        }
      });

      if (!post || !post.property) {
        this.logger.error(`Post or Property not found for ingestion: postId=${postId}`);
        return;
      }

      const amenities: string[] = Array.from(
        new Set(
          (post.property.propertyAmenities ?? [])
            .map((pa) => pa.amenity?.name)
            .filter((name): name is string => !!name),
        ),
      );

      const utilitiesRaw = (post.property.propertyUtilities ?? [])
        .map((pu) => ({
          name: pu.utility?.utilityName ?? '',
          distanceM: pu.distanceM ?? null,
          travelTimeS: pu.travelTimeS ?? null,
        }))
        .filter((u) => !!u.name);

      const utilitiesSorted = utilitiesRaw.sort(
        (a, b) => {
          const distA = a.distanceM !== null ? Number(a.distanceM) : 1e15;
          const distB = b.distanceM !== null ? Number(b.distanceM) : 1e15;
          return distA - distB;
        }
      );

      const utilitiesTop = utilitiesSorted.slice(0, 8);
      const utilityTags: string[] = Array.from(
        new Set(utilitiesRaw.map((u) => u.name)),
      );

      // Fix: Convert Decimal to number properly
      const priceValue = post.property.price ? Number(post.property.price) : 0;
      const areaValue = post.property.area ? Number(post.property.area) : null;

      const content = `
        === BẤT ĐỘNG SẢN ${post.id} ===
        Loại: ${post.postType === 'SALE' ? 'Cần bán' : post.postType === 'RENT' ? 'Cho thuê' : 'Khác'}
        Danh mục: ${post.property.category?.categoryName ?? 'N/A'}

        --- THÔNG TIN CHI TIẾT ---
        ${post.postTitle}

        ${post.postContent || ''}

        ${post.property.description || ''}

        --- ĐẶC ĐIỂM ---
        • Giá: ${priceValue.toLocaleString('vi-VN')} VNĐ
        • Diện tích: ${areaValue ?? 'N/A'} m²
        • Số phòng ngủ: ${post.property.bedroomNumber ?? 'N/A'}
        • Số phòng vệ sinh: ${post.property.toiletNumber ?? 'N/A'}
        • Hướng: ${post.property.orientation ?? 'N/A'}
        • Tình trạng nội thất: ${post.property.furnitureStatus ?? 'N/A'}

        --- VỊ TRÍ ---
        ${post.property.location ?? ''}
        ${post.property.ward?.name ? `Phường/Xã: ${post.property.ward.name}` : ''}
        ${post.property.district?.name ? `Quận/Huyện: ${post.property.district.name}` : ''}
        ${post.property.province?.name ? `Thành phố: ${post.property.province.name}` : ''}

        ${amenities.length ? `--- TIỆN ÍCH NỘI KHU ---\n${amenities.map(a => `• ${a}`).join('\n')}` : ''}

        ${utilitiesTop.length ? `--- TIỆN ÍCH XUNG QUANH ---\n${utilitiesTop.map(u => `• ${u.name}${u.distanceM ? ` (cách ${Number(u.distanceM)}m)` : ''}`).join('\n')}` : ''}
      `.trim();

      const metadata = {
        postId: post.id,
        propertyId: post.property.id,
        postType: post.postType,
        city: post.property.province?.name ?? null,
        district: post.property.district?.name ?? null,
        ward: post.property.ward?.name ?? null,
        price: priceValue,
        area: areaValue,
        bedrooms: post.property.bedroomNumber ?? null,
        categoryName: post.property.category?.categoryName ?? null,
        amenities,
        utilityTags,
        utilitiesTop: utilitiesTop.map(u => ({
          name: u.name,
          distanceM: u.distanceM ? Number(u.distanceM) : null,
          travelTimeS: u.travelTimeS,
        })),
      };

      const response = await fetch(`${aiServiceUrl}/api/ingest/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: [{ postId: post.id, content, metadata }]
        })
      });

      if (!response.ok) {
        this.logger.error(`Failed to ingest post to AI: ${await response.text()}`);
        return;
      }

      const result = await response.json();
      return result;
    } catch (error) {
      this.logger.error(`Error ingesting post to AI: ${error}`);
      return;
    }
  }

  private async updatePostInAI(postId: number) {
    try {
      const aiServiceUrl = this.configService.aiService.url || 'http://127.0.0.1:8001';

      const post = await this.prismaService.post.findFirst({
        where: { id: postId },
        include: {
          property: {
            include: {
              category: { select: { categoryName: true } },
              province: { select: { name: true } },
              district: { select: { name: true } },
              ward: { select: { name: true } },
              propertyAmenities: {
                select: { amenity: { select: { name: true } } }
              },
              propertyUtilities: {
                select: {
                  distanceM: true,
                  travelTimeS: true,
                  utility: { select: { utilityName: true } }
                }
              }
            }
          }
        }
      });

      if (!post || !post.property) {
        this.logger.error(`Post or Property not found: postId=${postId}`);
        return;
      }

      // Fix: Filter out null values explicitly
      const amenities: string[] = Array.from(
        new Set(
          (post.property.propertyAmenities ?? [])
            .map((pa) => pa.amenity?.name)
            .filter((name): name is string => !!name),
        ),
      );

      const utilitiesRaw = (post.property.propertyUtilities ?? [])
        .map((pu) => ({
          name: pu.utility?.utilityName ?? '',
          distanceM: pu.distanceM ?? null,
          travelTimeS: pu.travelTimeS ?? null,
        }))
        .filter((u) => !!u.name);

      const utilitiesSorted = utilitiesRaw.sort(
        (a, b) => {
          const distA = a.distanceM !== null ? Number(a.distanceM) : 1e15;
          const distB = b.distanceM !== null ? Number(b.distanceM) : 1e15;
          return distA - distB;
        }
      );

      const utilitiesTop = utilitiesSorted.slice(0, 8);
      const utilityTags: string[] = Array.from(
        new Set(utilitiesRaw.map((u) => u.name)),
      );

      const priceValue = post.property.price ? Number(post.property.price) : 0;
      const areaValue = post.property.area ? Number(post.property.area) : null;

      const content = `
        === BẤT ĐỘNG SẢN ${post.id} ===
        Loại: ${post.postType === 'SALE' ? 'Cần bán' : post.postType === 'RENT' ? 'Cho thuê' : 'Khác'}
        Danh mục: ${post.property.category?.categoryName ?? 'N/A'}

        --- THÔNG TIN CHI TIẾT ---
        ${post.postTitle}

        ${post.postContent || ''}

        ${post.property.description || ''}

        --- ĐẶC ĐIỂM ---
        • Giá: ${priceValue.toLocaleString('vi-VN')} VNĐ
        • Diện tích: ${areaValue ?? 'N/A'} m²
        • Số phòng ngủ: ${post.property.bedroomNumber ?? 'N/A'}
        • Số phòng vệ sinh: ${post.property.toiletNumber ?? 'N/A'}
        • Hướng: ${post.property.orientation ?? 'N/A'}
        • Tình trạng nội thất: ${post.property.furnitureStatus ?? 'N/A'}

        --- VỊ TRÍ ---
        ${post.property.location ?? ''}
        ${post.property.ward?.name ? `Phường/Xã: ${post.property.ward.name}` : ''}
        ${post.property.district?.name ? `Quận/Huyện: ${post.property.district.name}` : ''}
        ${post.property.province?.name ? `Thành phố: ${post.property.province.name}` : ''}

        ${amenities.length ? `--- TIỆN ÍCH NỘI KHU ---\n${amenities.map(a => `• ${a}`).join('\n')}` : ''}

        ${utilitiesTop.length ? `--- TIỆN ÍCH XUNG QUANH ---\n${utilitiesTop.map(u => `• ${u.name}${u.distanceM ? ` (cách ${Number(u.distanceM)}m)` : ''}`).join('\n')}` : ''}
      `.trim();

      const metadata = {
        postId: post.id,
        propertyId: post.property.id,
        postType: post.postType,
        city: post.property.province?.name ?? null,
        district: post.property.district?.name ?? null,
        ward: post.property.ward?.name ?? null,
        price: priceValue,
        area: areaValue,
        bedrooms: post.property.bedroomNumber ?? null,
        categoryName: post.property.category?.categoryName ?? null,
        amenities,
        utilityTags,
        utilitiesTop: utilitiesTop.map(u => ({
          name: u.name,
          distanceM: u.distanceM ? Number(u.distanceM) : null,
          travelTimeS: u.travelTimeS,
        })),
      };

      const response = await fetch(`${aiServiceUrl}/api/ingest/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, content, metadata })
      });

      if (!response.ok) {
        this.logger.error(`Failed to update post in AI: ${await response.text()}`);
        return;
      }

      const result = await response.json();
      this.logger.log(`Updated postId=${postId}: deleted ${result.deletedChunks}, ingested ${result.ingestedChunks} chunks`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating post in AI: ${error}`);
      return;
    }
  }

  private async deletePostFromAI(postId: number) {
    try {
      const aiServiceUrl = this.configService.aiService.url || 'http://127.0.0.1:8001';

      const response = await fetch(`${aiServiceUrl}/api/ingest/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        this.logger.error(`Failed to delete post from AI: ${await response.text()}`);
        return;
      }

      const result = await response.json();
      this.logger.log(`Deleted ${result.deletedChunks} chunks for postId=${postId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting post from AI: ${error}`);
      return;
    }
  }

  async executeQueuedPostIngest(data: PostIngestJobData) {
    if (data.action === "delete") {
      const result = await this.deletePostFromAI(data.postId);
      return {
        ok: true,
        postId: data.postId,
        action: data.action,
        trigger: data.trigger,
        result,
      };
    }

    const result = await this.updatePostInAI(data.postId);
    return {
      ok: true,
      postId: data.postId,
      action: data.action,
      trigger: data.trigger,
      result,
    };
  }

  private enqueuePostIngest(data: PostIngestJobData) {
    this.postIngestQueueService.enqueue(data)
      .then((queued) => {
        this.logger.log(
          `Post ingest job ${queued.alreadyQueued ? "already queued" : "queued"}: postId=${data.postId}, action=${data.action}, jobId=${queued.jobId}, status=${queued.status}`,
        );
      })
      .catch((err) => {
        this.logger.error(`Failed to queue post ingest job: postId=${data.postId}, action=${data.action}`, err?.stack || err);
      });
  }

  private ensureSort(orderKey?: string, sortOrder?: 'asc' | 'desc') {
    const key = orderKey && SORT_WHITELIST[orderKey] ? SORT_WHITELIST[orderKey] : 'createdAt';
    const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';
    return { [key]: order } as Prisma.PostOrderByWithRelationInput;
  }

  private ensurePublicSort(orderKey?: string, sortOrder?: 'asc' | 'desc') {
    const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';

    if (orderKey === 'price' || orderKey === 'area') {
      return { property: { [orderKey]: order } } as Prisma.PostOrderByWithRelationInput;
    }

    return this.ensureSort(orderKey, sortOrder);
  }

  private buildDecimalRange(from?: number, to?: number) {
    const hasFrom = from !== undefined && from !== null;
    const hasTo = to !== undefined && to !== null;
    if (!hasFrom && !hasTo) return undefined;

    let min = hasFrom ? from : undefined;
    let max = hasTo ? to : undefined;
    if (min !== undefined && max !== undefined && min > max) {
      [min, max] = [max, min];
    }

    return {
      ...(min !== undefined ? { gte: min } : {}),
      ...(max !== undefined ? { lte: max } : {}),
    };
  }

  async getAllPublicPosts(query: GetAllPostsDto) {
    const pagingParams = assignPaging(query);

    const orderBy = this.ensurePublicSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      postStatus: PostStatus.APPROVED,
      approvedAt: { not: null },
    }

    const propertyWhere: Prisma.PropertyWhereInput = {
      deletedAt: null,
      status: Status.ACTIVE,
    };
    const propertyAnd: Prisma.PropertyWhereInput[] = [];

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        { postTitle: { contains: q, mode: 'insensitive' } },
        { postContent: { contains: q, mode: 'insensitive' } },
        { property: { title: { contains: q, mode: 'insensitive' } } },
        { property: { location: { contains: q, mode: 'insensitive' } } },
        { property: { province: { name: { contains: q, mode: 'insensitive' } } } },
        { property: { district: { name: { contains: q, mode: 'insensitive' } } } },
        { property: { ward: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (pagingParams.type) Object.assign(where, { postType: pagingParams.type });

    const priceRange = this.buildDecimalRange(pagingParams.priceFrom, pagingParams.priceTo);
    if (priceRange) propertyWhere.price = priceRange;

    const areaRange = this.buildDecimalRange(pagingParams.areaFrom, pagingParams.areaTo);
    if (areaRange) propertyWhere.area = areaRange;

    if (pagingParams.bedroomNumber !== undefined) {
      propertyWhere.bedroomNumber = { gte: pagingParams.bedroomNumber };
    }

    if (pagingParams.toiletNumber !== undefined) {
      propertyWhere.toiletNumber = { gte: pagingParams.toiletNumber };
    }

    if (pagingParams.categoryId) propertyWhere.categoryId = pagingParams.categoryId;
    if (pagingParams.provinceId) propertyWhere.provinceId = pagingParams.provinceId;
    if (pagingParams.districtId) propertyWhere.districtId = pagingParams.districtId;
    if (pagingParams.wardId) propertyWhere.wardId = pagingParams.wardId;

    if (pagingParams.amenityIds?.length) {
      propertyAnd.push(
        ...pagingParams.amenityIds.map((amenityId: number) => ({
          propertyAmenities: {
            some: {
              amenityId,
              deletedAt: null,
              amenity: { deletedAt: null },
            },
          },
        })),
      );
    }

    if (pagingParams.utilityIds?.length) {
      propertyAnd.push(
        ...pagingParams.utilityIds.map((utilityId: number) => ({
          propertyUtilities: {
            some: {
              utilityId,
              deletedAt: null,
              utility: { deletedAt: null },
            },
          },
        })),
      );
    }

    if (propertyAnd.length) propertyWhere.AND = propertyAnd;

    where.property = { is: propertyWhere };

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
              area: true,
              bedroomNumber: true,
              toiletNumber: true,
              location: true,
              category: {
                select: {
                  id: true,
                  categoryName: true,
                },
              },
              province: {
                select: {
                  id: true,
                  name: true,
                },
              },
              district: {
                select: {
                  id: true,
                  name: true,
                },
              },
              ward: {
                select: {
                  id: true,
                  name: true,
                },
              },
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

  async getOnePublicPost(postId: number, userId?: number) {
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
        favorites: {
          where: {
            userId: userId || -1,
            postId,
            deletedAt: null,
          },
          select: { id: true }
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
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        "UNAUTHORIZED USER",
        HttpStatus.UNAUTHORIZED,
      )
    }

    const role = await this.prismaService.role.findFirst({
      where: { id: user.roleId },
      select: { name: true }
    });
    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
    }

    if (role?.name == RoleType.AGENT) {
      where.createdById = user.id;
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
      throw new ApiException("UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    }

    const roleOfLoginUser = await this.prismaService.role.findFirst({
      where: { id: user.roleId },
      select: { name: true }
    });

    const existPost = await this.prismaService.post.findFirst({
      where: { id: postId, deletedAt: null }
    });

    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND
      );
    }

    const isAdmin = roleOfLoginUser?.name === 'ADMIN';
    const isOwner = existPost.createdById === user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiException(
        'FORBIDDEN: You do not have permission to update this post',
        HttpStatus.FORBIDDEN
      );
    }

    let updatedPost;

    try {
      updatedPost = await this.prismaService.$transaction(async (prisma) => {
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
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Nếu post đã approved, update embeddings trong AI
    if (updatedPost.postStatus === PostStatus.APPROVED) {
      this.enqueuePostIngest({
        postId,
        action: "upsert",
        trigger: "update",
        requestedById: user.id,
      });
    }

    return updatedPost;
  }

  async deletePost(postId: number) {
    const user: User = ContextProvider.getAuthUser();
    if (!user) {
      throw new ApiException("UNAUTHORIZED USER", HttpStatus.UNAUTHORIZED);
    }

    const roleOfLoginUser = await this.prismaService.role.findFirst({
      where: { id: user.roleId },
      select: { name: true }
    });

    const existPost = await this.prismaService.post.findFirst({
      where: { id: postId, deletedAt: null }
    });

    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND
      );
    }

    // only admin or creator can update
    const isAdmin = roleOfLoginUser?.name === 'ADMIN';
    const isOwner = existPost.createdById === user.id;

    if (!isAdmin && !isOwner) {
      throw new ApiException(
        'FORBIDDEN: You do not have permission to update this post',
        HttpStatus.FORBIDDEN
      );
    }

    let deletedPost;

    try {
      deletedPost = await this.prismaService.$transaction(async (prisma) => {
        const deleted = await prisma.post.update({
          where: { id: postId },
          data: {
            deletedAt: new Date(),
            publishedAt: null,
          }
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'SOFT_DELETE_POST',
            entity: 'Post',
            entityId: postId,
          },
        });

        return deleted;
      });
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: Post #id${postId} and error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Xóa embeddings trong AI
    this.enqueuePostIngest({
      postId,
      action: "delete",
      trigger: "delete",
      requestedById: user.id,
    });

    return deletedPost;
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
    if (!user) {
      throw new ApiException('UNAUTHORIZED USER', HttpStatus.UNAUTHORIZED);
    }

    const existPost = await this.prismaService.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
      },
      select: {
        id: true,
        propertyId: true,
      },
    });

    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    let approvedPost;

    try {
      approvedPost = await this.prismaService.$transaction(async (prisma) => {
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
    } catch (error) {
      throw new ApiException(
        `Error while approving post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.enqueuePostIngest({
      postId,
      action: "upsert",
      trigger: "approve",
      requestedById: user.id,
    });

    return approvedPost;
  }

  async approvePosts(dto: BatchApprovePostDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException('UNAUTHORIZED USER', HttpStatus.UNAUTHORIZED);
    }

    const postIds = Array.from(new Set((dto.postIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    if (!postIds.length) {
      throw new ApiException('postIds is required', HttpStatus.BAD_REQUEST);
    }

    const existingPosts = await this.prismaService.post.findMany({
      where: {
        id: { in: postIds },
        deletedAt: null,
      },
      select: { id: true },
    });
    const approvedIds = existingPosts.map((post) => post.id);
    const approvedIdSet = new Set(approvedIds);
    const missingIds = postIds.filter((id) => !approvedIdSet.has(id));

    if (!approvedIds.length) {
      throw new ApiException(`${ItemMessage.NOT_FOUND}: Post`, HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    await this.prismaService.$transaction(async (prisma) => {
      await prisma.post.updateMany({
        where: { id: { in: approvedIds } },
        data: {
          approvedById: user.id,
          approvedAt: now,
          rejectedById: null,
          rejectReason: null,
          postStatus: PostStatus.APPROVED,
        },
      });

      await prisma.auditLog.createMany({
        data: approvedIds.map((postId) => ({
          userId: user.id,
          action: 'APPROVE_POST',
          entity: 'Post',
          entityId: postId,
        })),
      });
    });

    for (const postId of approvedIds) {
      this.enqueuePostIngest({
        postId,
        action: "upsert",
        trigger: "approve",
        requestedById: user.id,
      });
    }

    return {
      approvedIds,
      missingIds,
      approvedCount: approvedIds.length,
      requestedCount: postIds.length,
      queuedIngestJobs: approvedIds.length,
    };
  }

  async rejectPost(postId: number, dto: RejectPostDto) {
    const user: User = ContextProvider.getAuthUser();
    if (!user) throw new ApiException('UNAUTHORIZED USER', HttpStatus.UNAUTHORIZED);

    const existPost = await this.prismaService.post.findFirst({
      where: { id: postId, deletedAt: null }
    });

    if (!existPost) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Post #id${postId}`,
        HttpStatus.NOT_FOUND
      );
    }

    let rejected;

    try {
      rejected = await this.prismaService.$transaction(async (prisma) => {
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
    } catch (error) {
      throw new ApiException(
        `Error while rejecting post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Xóa embeddings khi reject
    this.enqueuePostIngest({
      postId,
      action: "delete",
      trigger: "reject",
      requestedById: user.id,
    });

    return rejected;
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

    let archived;

    try {
      archived = await this.prismaService.$transaction(async (prisma) => {
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
    } catch (error) {
      throw new ApiException(
        `Error while archiving post: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }

    // Xóa embeddings khi archive
    this.enqueuePostIngest({
      postId,
      action: "delete",
      trigger: "archive",
      requestedById: user.id,
    });

    return archived;
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

  async getReports(query: GetAllReportDto) {
    const paging = assignPaging(query);

    const [reports, total] = await Promise.all([
      this.prismaService.report.findMany({
        where: {},
        skip: paging.skip,
        take: paging.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              postTitle: true,
            }
          },
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        }
      }),
      this.prismaService.report.count({ where: {} }),
    ]);

    return returnPaging(reports, total, paging);
  }

  async updateReport(reportId: number, dto: UpdateReportDto) {
    const existReport = await this.prismaService.report.findFirst({
      where: { id: reportId }
    });
    if (!existReport) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Report #id${reportId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const updated = await this.prismaService.report.update({
        where: { id: reportId },
        data: {
          status: dto.status ?? existReport.status,
        }
      });
      return updated;
    } catch (error) {
      throw new ApiException(
        `Error while updating report: Report #id${reportId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
