import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { CreateArticleDto } from "../dto/articles/create-article.dto";
import { GetAllArticleDto } from "../dto/articles/get-all-article.dto";
import { UpdateArticleDto } from "../dto/articles/update-article.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { Prisma, User } from "@prisma/client";
import { ContextProvider } from "libs/utils/providers/context.provider";

@Injectable()
export class NewsArticleService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async create(createArticleDto: CreateArticleDto) {
    const topic = await this.prismaService.newsTopic.findUnique({
      where: {
        id: createArticleDto.topicId,
        deletedAt: null,
      },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with ID ${createArticleDto.topicId} not found`);
    }

    // If status is PUBLISHED and no publishedAt, set it
    const data: any = { ...createArticleDto };
    if (createArticleDto.status === "PUBLISHED" && !data.publishedAt) {
      data.publishedAt = new Date();
    }

    return this.prismaService.newsArticle.create({
      data,
      include: {
        topic: true,
      },
    });
  }

  async getAll(query: GetAllArticleDto) {
    const paging = assignPaging(query);
    const { pageIndex, pageSize, sortKey, sortOrder, skip, topicId, status, search } = paging;

    const where: Prisma.NewsArticleWhereInput = {
      deletedAt: null,
    };

    if (topicId) {
      where.topicId = topicId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prismaService.newsArticle.findMany({
        where,
        orderBy: { [sortKey]: sortOrder },
        skip,
        take: pageSize,
        include: {
          topic: true,
          _count: {
            select: { savedBy: true },
          },
        },
      }),
      this.prismaService.newsArticle.count({ where }),
    ]);

    return returnPaging(articles, total, paging);
  }

  async getOne(id: number) {
    const article = await this.prismaService.newsArticle.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        topic: true,
        _count: {
          select: { savedBy: true },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    return article;
  }

  async update(id: number, updateArticleDto: UpdateArticleDto) {
    // Check if article exists
    const existing = await this.getOne(id);

    // If updating topicId, check if topic exists
    if (updateArticleDto.topicId) {
      const topic = await this.prismaService.newsTopic.findFirst({
        where: { id: updateArticleDto.topicId, deletedAt: null },
      });

      if (!topic) {
        throw new NotFoundException(`Topic with ID ${updateArticleDto.topicId} not found`);
      }
    }

    // If changing status to PUBLISHED and no publishedAt, set it
    const data: any = { ...updateArticleDto };
    if (updateArticleDto.status === "PUBLISHED") {
      if (!existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    return this.prismaService.newsArticle.update({
      where: { id },
      data,
      include: {
        topic: true,
      },
    });
  }

  async deleteArticle(id: number) {
    // Check if article exists
    await this.getOne(id);

    return this.prismaService.newsArticle.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async toggleFeatured(id: number) {
    const article = await this.getOne(id);

    return this.prismaService.newsArticle.update({
      where: { id },
      data: {
        isFeatured: !article.isFeatured,
      },
      include: {
        topic: true,
      },
    });
  }

  async publish(id: number) {
    const article = await this.getOne(id);

    return this.prismaService.newsArticle.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: article.publishedAt || new Date(),
      },
      include: {
        topic: true,
      },
    });
  }

  async unpublish(id: number) {
    await this.getOne(id);

    return this.prismaService.newsArticle.update({
      where: { id },
      data: {
        status: "DRAFT",
      },
      include: {
        topic: true,
      },
    });
  }

  async toggleSave(id: number) {
    const user = ContextProvider.getAuthUser<User>();
    const article = await this.getOne(id);

    // Check if already saved
    const existing = await this.prismaService.savedNewsArticle.findFirst({
      where: {
        articleId: id,
        userId: user.id,
      },
    });
    if (existing) {
      // Unsave
      await this.prismaService.savedNewsArticle.delete({
        where: {
          id: existing.id,
        },
      });
      return { message: "Article unsaved successfully" };
    } else {
      // Save
      await this.prismaService.savedNewsArticle.create({
        data: {
          articleId: article.id,
          userId: user.id,
        },
      });
      return { message: "Article saved successfully" };
    }
  }

  async getAllSavedArticles() {
    const user = ContextProvider.getAuthUser<User>();

    const savedArticles = await this.prismaService.savedNewsArticle.findMany({
      where: {
        userId: user.id,
        article: {
          deletedAt: null,
        },
      },
      include: {
        article: {
          include: {
            topic: true,
            _count: {
              select: { savedBy: true },
            },
          },
        },
      },
    });

    return savedArticles;
  }
}