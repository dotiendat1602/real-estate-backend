import { Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";

@Injectable()
export class LocationService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async getAllProvinces() {
    return this.prismaService.province.findMany();
  }

  async getDistrictsByProvince(provinceId: number) {
    return this.prismaService.district.findMany({
      where: {
        province_id: provinceId,
      },
    });
  }

  async getWardsByDistrict(districtId: number) {
    return this.prismaService.ward.findMany({
      where: {
        district_id: districtId
      },
    });
  }
}