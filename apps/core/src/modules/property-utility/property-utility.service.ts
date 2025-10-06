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

    let province: { province_id: number } | null = null;
    let district: { district_id: number; province_id: number } | null = null;
    let ward: { ward_id: number; district_id: number } | null = null;

    if (province_id) {
      province = await this.prismaService.province.findUnique({
        where: { province_id },
        select: { province_id: true },
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
        where: { district_id },
        select: { district_id: true, province_id: true },
      });
      if (!district) {
        throw new ApiException(
          'District not found',
          HttpStatus.NOT_FOUND
        );
      }
      if (province && district.province_id !== province.province_id) {
        throw new ApiException(
          'District does not belong to the given province',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (ward_id) {
      ward = await this.prismaService.ward.findUnique({
        where: { ward_id },
        select: { ward_id: true, district_id: true },
      });
      if (!ward) {
        throw new ApiException(
          'Ward not found',
          HttpStatus.NOT_FOUND
        );
      }
      if (district && ward.district_id !== district.district_id) {
        throw new ApiException(
          'Ward does not belong to the given district',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    return {
      province_id: province?.province_id,
      district_id: district?.district_id,
      ward_id: ward?.ward_id
    };
  }

  async getAllPropertyUtilities(query: GetAllPropertyUtilitiesDto) {
    const pagingParams = assignPaging(query);

    const orderObject = {
      [pagingParams.sortBy || 'utility_name']: pagingParams.sortOrder || 'asc',
    }

    const where: Prisma.UtilityWhereInput = {};

    if (query.utilityName) {
      const q = query.utilityName.trim();
      where.utility_name = {
        contains: q,
        mode: 'insensitive',
      }
    }
    if (query.utilityCategory) {
      where.utility_category = query.utilityCategory;
    }
    if (query.province_id) where.province_id = query.province_id;
    if (query.district_id) where.district_id = query.district_id;
    if (query.ward_id) where.ward_id = query.ward_id;

    const utilities = await this.prismaService.utility.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.take,
    });

    const total = await this.prismaService.utility.count({ where });

    return returnPaging(utilities, total, pagingParams);
  }

  async createPropertyUtility(dto: CreatePropertyUtilityDto) {
    const loc = await this.validateLocationIds(dto.province_id, dto.district_id, dto.ward_id);

    try {
      const newUtility = await this.prismaService.utility.create({
        data: {
          utility_name: dto.utility_name,
          utility_category: dto.utility_category,
          lat: dto.lat,
          lon: dto.lon,
          location: dto.location,
          province: loc.province_id ? { connect: { province_id: loc.province_id } } : undefined,
          district: loc.district_id ? { connect: { district_id: loc.district_id } } : undefined,
          ward: loc.ward_id ? { connect: { ward_id: loc.ward_id } } : undefined,
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
        utility_id: utilityId,
      },
    });
    if (!existUtility) {
      throw new ApiException(
        'Utility not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // nếu client gửi ID mới → validate; nếu không gửi → giữ nguyên
    const targetProvinceId = dto.province_id ?? existUtility.province_id ?? undefined;
    const targetDistrictId = dto.district_id ?? existUtility.district_id ?? undefined;
    const targetWardId = dto.ward_id ?? existUtility.ward_id ?? undefined;

    const loc = await this.validateLocationIds(targetProvinceId, targetDistrictId, targetWardId);

    try {
      const updateUtility = await this.prismaService.utility.update({
        where: { utility_id: utilityId },
        data: {
          utility_name: dto.utility_name ?? existUtility.utility_name,
          utility_category: dto.utility_category ?? existUtility.utility_category,
          lat: dto.lat ?? existUtility.lat,
          lon: dto.lon ?? existUtility.lon,
          location: dto.location ?? existUtility.location,
          province_id: loc.province_id ?? null,
          district_id: loc.district_id ?? null,
          ward_id: loc.ward_id ?? null,
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
        utility_id: utilityId,
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
            utility_id: utilityId,
          },
        });

        return await prisma.utility.delete({
          where: {
            utility_id: utilityId,
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