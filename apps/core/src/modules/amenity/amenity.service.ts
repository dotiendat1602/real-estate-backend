import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllAmenityDto } from "./dto/get-all-amenity.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { CreateAmenityDto } from "./dto/create-amenity.dto";
import { UpdateAmenityDto } from "./dto/update-amenity.dto";
import { AmenityCategory, Prisma } from "@prisma/client";
import { ApiException } from "libs/utils/exception";
import { ErrorCode, ItemMessage } from "libs/utils/enum";

@Injectable()
export class AmenityService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async getAllAmenityMetaData(category?: string) {
    const where: Prisma.AmenityWhereInput = {
      deletedAt: null,
    };

    if (category && !Object.values(AmenityCategory).includes(category as AmenityCategory)) {
      throw new ApiException(
        `Invalid category`,
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_INPUT,
      );
    }

    if (category) {
      where.category = category as AmenityCategory;
    }

    const amenities = await this.prismaService.amenity.findMany({
      where,
      orderBy: {
        name: 'asc',
      }
    });
    return amenities;
  }

  async getAllAmenities(query: GetAllAmenityDto) {
    const pagingParams = assignPaging(query);

    const orderObject = {
      [pagingParams.sortKey || 'name']: pagingParams.sortOrder || 'asc',
    };

    const where: Prisma.AmenityWhereInput = {};

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.name = {
        contains: q,
        mode: "insensitive",
      }
    }

    if (pagingParams.category) {
      where.category = pagingParams.category
    }

    const amenities = await this.prismaService.amenity.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        id: true,
        name: true,
        category: true,
        _count: { select: { properties: true } },
      },
    });

    const data = amenities.map(({ _count, ...a }) => ({
      ...a,
      propertiesCount: _count.properties,
    }));

    const total = await this.prismaService.amenity.count({
      where,
    })

    return returnPaging(data, total, pagingParams);
  }

  async createAmenity(dto: CreateAmenityDto) {
    try {
      const newAmenity = await this.prismaService.amenity.create({
        data: {
          name: dto.name,
          category: dto.category,
        }
      })
      return newAmenity;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async updateAmenity(amenityId: number, dto: UpdateAmenityDto) {
    const existAmenity = await this.prismaService.amenity.findFirst({
      where: {
        id: amenityId,
        deletedAt: null,
      }
    })
    if (!existAmenity) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Amenity`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }

    try {
      const updateAmenity = await this.prismaService.amenity.update({
        where: {
          id: amenityId,
        },
        data: {
          name: dto.name ?? existAmenity.name,
          category: dto.category ?? existAmenity.category,
        }
      })
      return updateAmenity;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async deleteAmenity(amenityId: number) {
    const existAmenity = await this.prismaService.amenity.findFirst({
      where: {
        id: amenityId,
        deletedAt: null,
      }
    })
    if (!existAmenity) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Amenity`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      )
    }

    try {
      const deleteAmenity = await this.prismaService.$transaction(async (prisma) => {
        await prisma.propertyAmenity.updateMany({
          where: {
            amenityId: amenityId,
          },
          data: {
            deletedAt: new Date(),
          }
        })

        const amenity = await prisma.amenity.update({
          where: {
            id: amenityId,
          },
          data: {
            deletedAt: new Date(),
          }
        })
        return amenity;
      })
      return deleteAmenity;

    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      );
    }
  }
}
