import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllPropertyUtilitiesDto } from "./dto/get-all-utility.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { Prisma } from "@prisma/client";
import { CreatePropertyUtilityDto } from "./dto/create-utility.dto";
import { ApiException } from "libs/utils/exception";
import { UpdatePropertyUtilityDto } from "./dto/update-utility.dto";
import { ItemMessage } from "libs/utils/enum";

@Injectable()
export class PropertyUtilityService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  private async validateLocationIds(
    province_id?: number,
    district_id?: number,
    ward_id?: number,
  ) {
    if (ward_id && !district_id) {
      throw new ApiException('Ward requires district_id', HttpStatus.BAD_REQUEST);
    }
    if (district_id && !province_id) {
      throw new ApiException('District requires province_id', HttpStatus.BAD_REQUEST);
    }

    let province: { id: number } | null = null;
    let district: { id: number; provinceId: number } | null = null;
    let ward: { id: number; districtId: number } | null = null;

    if (province_id) {
      province = await this.prismaService.province.findUnique({
        where: { id: province_id },
        select: { id: true },
      });
      if (!province) {
        throw new ApiException(
          'Province not found',
          HttpStatus.NOT_FOUND
        );
      }
    }

    if (district_id) {
      district = await this.prismaService.district.findUnique({
        where: { id: district_id },
        select: { id: true, provinceId: true },
      });
      if (!district) {
        throw new ApiException(
          'District not found',
          HttpStatus.NOT_FOUND
        );
      }
      if (province && district.provinceId !== province.id) {
        throw new ApiException(
          'District does not belong to the given province',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (ward_id) {
      ward = await this.prismaService.ward.findUnique({
        where: { id: ward_id },
        select: { id: true, districtId: true },
      });
      if (!ward) {
        throw new ApiException(
          'Ward not found',
          HttpStatus.NOT_FOUND
        );
      }
      if (district && ward.districtId !== district.id) {
        throw new ApiException(
          'Ward does not belong to the given district',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    return {
      province_id: province?.id,
      district_id: district?.id,
      ward_id: ward?.id
    };
  }

  async getAllPropertyUtilities(query: GetAllPropertyUtilitiesDto) {
    const pagingParams = assignPaging(query);

    const sortWhitelist: Record<string, keyof Prisma.UtilityOrderByWithRelationInput> = {
      id: 'id',
      utilityName: 'utilityName',
      utilityCategory: 'utilityCategory',
      location: 'location',
    };
    const sortKey = sortWhitelist[pagingParams.sortKey] ?? sortWhitelist[pagingParams.sortBy] ?? 'utilityName';

    const orderObject = {
      [sortKey]: pagingParams.sortOrder || 'asc',
    }

    const where: Prisma.UtilityWhereInput = {
      deletedAt: null,
    };

    if (query.utilityName) {
      const q = query.utilityName.trim();
      where.utilityName = {
        contains: q,
        mode: 'insensitive',
      }
    }
    if (query.utilityCategory) {
      where.utilityCategory = query.utilityCategory;
    }
    if (query.province_id) where.provinceId = query.province_id;
    if (query.district_id) where.districtId = query.district_id;
    if (query.ward_id) where.wardId = query.ward_id;

    const utilities = await this.prismaService.utility.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
    });

    const total = await this.prismaService.utility.count({ where });

    return returnPaging(utilities, total, pagingParams);
  }

  async createPropertyUtility(dto: CreatePropertyUtilityDto) {
    const loc = await this.validateLocationIds(dto.province_id, dto.district_id, dto.ward_id);

    try {
      const newUtility = await this.prismaService.utility.create({
        data: {
          utilityName: dto.utility_name,
          utilityCategory: dto.utility_category,
          lat: dto.lat,
          lon: dto.lon,
          location: dto.location,
          province: loc.province_id ? { connect: { id: loc.province_id } } : undefined,
          district: loc.district_id ? { connect: { id: loc.district_id } } : undefined,
          ward: loc.ward_id ? { connect: { id: loc.ward_id } } : undefined,
        }
      });
      return newUtility;
    } catch (error) {
      throw new ApiException(
        'Error creating property utility',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePropertyUtility(utilityId: number, dto: UpdatePropertyUtilityDto) {
    const existUtility = await this.prismaService.utility.findFirst({
      where: {
        id: utilityId,
      },
    });
    if (!existUtility) {
      throw new ApiException(
        'Utility not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // nếu client gửi ID mới → validate; nếu không gửi → giữ nguyên
    const targetProvinceId = dto.province_id ?? existUtility.provinceId ?? undefined;
    const targetDistrictId = dto.district_id ?? existUtility.districtId ?? undefined;
    const targetWardId = dto.ward_id ?? existUtility.wardId ?? undefined;

    const loc = await this.validateLocationIds(targetProvinceId, targetDistrictId, targetWardId);

    try {
      const updateUtility = await this.prismaService.utility.update({
        where: { id: utilityId },
        data: {
          utilityName: dto.utility_name ?? existUtility.utilityName,
          utilityCategory: dto.utility_category ?? existUtility.utilityCategory,
          lat: dto.lat ?? existUtility.lat,
          lon: dto.lon ?? existUtility.lon,
          location: dto.location ?? existUtility.location,
          provinceId: loc.province_id ?? null,
          districtId: loc.district_id ?? null,
          wardId: loc.ward_id ?? null,
        }
      });
      return updateUtility;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deletePropertyUtility(utilityId: number) {
    const existUtility = await this.prismaService.utility.findFirst({
      where: {
        id: utilityId,
      },
    });
    if (!existUtility) {
      throw new ApiException(
        'Utility not found',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      const deleted = await this.prismaService.$transaction(async (prisma) => {
        await prisma.propertyUtility.deleteMany({
          where: {
            utilityId: utilityId,
          },
        });

        return await prisma.utility.delete({
          where: {
            id: utilityId,
          },
        });
      });
      return deleted;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
