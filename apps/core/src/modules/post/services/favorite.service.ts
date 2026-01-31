import { HttpStatus, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { ApiException } from "libs/utils/exception";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { ContextProvider } from "libs/utils/providers/context.provider";
import { GetFavoritesPostDto } from "../dto/get-favorite.dto";

@Injectable()
export class FavoriteService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async getFavoritesPost(query: GetFavoritesPostDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }

    const paging = assignPaging(query);

    const [favoritePosts, total] = await Promise.all([
      this.prismaService.favorites.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        skip: paging.skip,
        take: paging.take,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          post: {
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
            }
          }
        }
      }),
      this.prismaService.favorites.count({
        where: {
          userId: user.id,
          deletedAt: null,
        },
      })
    ]);
    const posts = favoritePosts.map(fav => fav.post);
    return returnPaging(posts, total, paging);
  }

  async addOrRemoveFavorites(postId: number) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(`UNAUTHORIZED USER`, HttpStatus.UNAUTHORIZED);
    }

    const post = await this.prismaService.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true },
    });

    if (!post) {
      throw new ApiException(
        `NOT_FOUND: Post #id${postId}`,
        HttpStatus.NOT_FOUND
      );
    }

    try {
      const result = await this.prismaService.$transaction(async (prisma) => {
        // Find favorite by unique key (includes deleted rows)
        const existing = await prisma.favorites.findUnique({
          where: {
            userId_postId: {
              userId: user.id,
              postId,
            },
          },
        });

        // 1) Not exist -> create
        if (!existing) {
          const created = await prisma.favorites.create({
            data: { userId: user.id, postId },
          });

          return {
            isFavorited: true,
            action: 'ADDED',
            favorite: created,
          };
        }

        // 2) Exist but soft-deleted -> restore
        if (existing.deletedAt) {
          const restored = await prisma.favorites.update({
            where: { id: existing.id },
            data: { deletedAt: null },
          });

          return {
            isFavorited: true,
            action: 'RESTORED',
            favorite: restored,
          };
        }

        // 3) Exist & active -> soft delete
        const removed = await prisma.favorites.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });

        return {
          isFavorited: false,
          action: 'REMOVED',
          favorite: removed,
        };
      });

      return result;
    } catch (error) {
      throw new ApiException(
        `FAIL_TOGGLE_FAVORITE: Post #id${postId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
