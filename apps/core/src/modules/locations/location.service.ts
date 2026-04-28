import { Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";

@Injectable()
export class LocationService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async getAllProvinces() {
    return this.prismaService.province.findMany({
      orderBy: {
        name: 'asc'
      }
    });
  }

  async getDistrictsByProvince(provinceId: number) {
    return this.prismaService.district.findMany({
      where: {
        provinceId: provinceId,
      },
      orderBy: {
        name: 'asc'
      }
    });
  }

  async getWardsByDistrict(districtId: number) {
    return this.prismaService.ward.findMany({
      where: {
        districtId: districtId
      },
      orderBy: {
        name: 'asc'
      }
    });
  }
}