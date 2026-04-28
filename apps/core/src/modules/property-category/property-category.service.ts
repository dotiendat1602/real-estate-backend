import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllPropertyCategoryDto } from "./dto/get-all-category.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { Prisma } from "@prisma/client";
import { CreatePropertyCategoryDto } from "./dto/create-category.dto";
import { ApiException } from "libs/utils/exception";
import { ErrorCode, ItemMessage } from "libs/utils/enum";
import { UpdatePropertyCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class PropertyCategoryService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async getPropertyCategoryMetaData() {
    const categories = await this.prismaService.propertyCategory.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        categoryName: 'asc',
      }
    });
    return categories;
  }

  async getAllPropertyCategory(dto: GetAllPropertyCategoryDto) {
    const pagingParams = assignPaging(dto);

    const orderObject = {
      [pagingParams.sortKey || 'category_name']: pagingParams.sortOrder || 'asc',
    };

    const where: Prisma.PropertyCategoryWhereInput = {
      deletedAt: null,
    };

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        {
          categoryName: {
            contains: q,
            mode: "insensitive",
          }
        },
        {
          categoryDescription: {
            contains: q,
            mode: "insensitive",
          }
        }
      ]
    }

    const categories = await this.prismaService.propertyCategory.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        id: true,
        categoryName: true,
        categoryDescription: true,
        createdAt: true,
      }
    })

    const totalItems = await this.prismaService.propertyCategory.count({
      where,
    })

    return returnPaging(categories, totalItems, pagingParams);
  }

  async createPropertyCategory(dto: CreatePropertyCategoryDto) {
    try {
      const newCategory = await this.prismaService.propertyCategory.create({
        data: {
          categoryName: dto.categoryName,
          categoryDescription: dto.categoryDescription ?? "",
        }
      })
      return newCategory;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      )
    }
  }

  async updatePropertyCategory(categoryId: number, dto: UpdatePropertyCategoryDto) {
    const existCategory = await this.prismaService.propertyCategory.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
      },
    })
    if (!existCategory) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Category`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }

    const data: Prisma.PropertyCategoryUpdateInput = {};

    if (
      typeof dto.categoryName === 'string' &&
      dto.categoryName.trim() !== '' &&
      dto.categoryName !== existCategory.categoryName
    ) {
      // Kiểm tra trùng tên với bản ghi khác
      const duplicated = await this.prismaService.propertyCategory.findFirst({
        where: {
          categoryName: dto.categoryName,
          deletedAt: null,
          NOT: { id: categoryId },
        },
        select: { id: true },
      });
      if (duplicated) {
        throw new ApiException(
          `Category name already exists`,
          HttpStatus.CONFLICT,
          ErrorCode.INVALID_INPUT,
        );
      }
      data.categoryName = dto.categoryName;
    }

    try {
      const updateCategory = await this.prismaService.propertyCategory.update({
        where: { id: categoryId },
        data,
      });
      return updateCategory;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      )
    }
  }

  async deletePropertyCategory(categoryId: number) {
    const existCategory = await this.prismaService.propertyCategory.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
      },
    })
    if (!existCategory) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Category`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }

    try {
      const deleteCategory = await this.prismaService.propertyCategory.update({
        where: {
          id: categoryId,
        },
        data: {
          deletedAt: new Date(),
        }
      })
      return deleteCategory;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      )
    }
  }
}