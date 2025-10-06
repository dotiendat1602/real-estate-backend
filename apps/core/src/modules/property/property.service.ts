import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllPropertyDto } from "./dto/get-all-property.dto";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { Prisma, User } from "@prisma/client";
import { ApiException } from "libs/utils/exception";
import { ItemMessage } from "libs/utils/enum";
import { ContextProvider } from "libs/utils/providers/context.provider";

@Injectable()
export class PropertyService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  private async checkExistProperty(propertyId: number) {
    const existProperty = await this.prismaService.property.findFirst({
      where: { property_id: propertyId, deletedAt: null },
    });
    if (!existProperty) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Property`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async checkExistAmenity(amenityId: number) {
    const existAmenity = await this.prismaService.amenity.findFirst({
      where: { amenity_id: amenityId, deletedAt: null },
    });
    if (!existAmenity) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Amenity`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async checkExistUtility(utilityId: number) {
    const existUtility = await this.prismaService.utility.findFirst({
      where: { utility_id: utilityId, deletedAt: null },
    });
    if (!existUtility) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Utility`,
        HttpStatus.NOT_FOUND
      );
    }
  }

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

  async getAllProperty(query: GetAllPropertyDto) {
    const pagingParams = assignPaging(query);

    const orderObject = {
      [pagingParams.sortKey || 'title']: pagingParams.sortOrder || 'asc',
    }

    const where: Prisma.PropertyWhereInput = {
      deletedAt: null,
    }

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.title = {
        contains: q,
        mode: "insensitive",
      }
    }

    if (pagingParams.status) {
      where.status = pagingParams.status
    }

    const hasFrom = pagingParams.priceFrom !== undefined && pagingParams.priceFrom !== null;
    const hasTo = pagingParams.priceTo !== undefined && pagingParams.priceTo !== null;

    if (hasFrom || hasTo) {
      let from = hasFrom ? pagingParams.priceFrom : undefined;
      let to = hasTo ? pagingParams.priceTo : undefined;
      // swap nếu from > to
      if (from !== undefined && to !== undefined && from > to) {
        [from, to] = [to, from];
      }

      where.price = {
        ...(from !== undefined ? { gte: from } : {}),
        ...(to !== undefined ? { lte: to } : {}),
      };
    }

    let provinceId: number | undefined;
    let districtId: number | undefined;
    let wardId: number | undefined;

    // check province
    if (pagingParams.province) {
      const province = await this.prismaService.province.findFirst({
        where: {
          name: pagingParams.province,
        },
        select: { province_id: true },
      });
      if (!province) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: Province`,
          HttpStatus.NOT_FOUND,
        )
      }

      provinceId = province.province_id;
      where.province_id = provinceId;
    }

    // check district
    if (pagingParams.district) {
      const district = await this.prismaService.district.findFirst({
        where: {
          name: pagingParams.district,
          ...(provinceId ? { province_id: provinceId } : {}),
        },
        select: { district_id: true, province_id: true },
      });
      if (!district) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: District`,
          HttpStatus.NOT_FOUND,
        )
      }

      districtId = district.district_id;
      // Nếu chưa có provinceId mà district có, cũng gán where.province_id
      where.district_id = districtId;
      if (!provinceId) where.province_id = district.province_id;
    }

    // check ward
    if (pagingParams.ward) {
      const ward = await this.prismaService.ward.findFirst({
        where: {
          name: pagingParams.ward,
          ...(districtId ? { district_id: districtId } : {}),
        },
        select: { ward_id: true, district_id: true },
      });
      if (!ward) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: Ward`,
          HttpStatus.NOT_FOUND,
        )
      }

      wardId = ward.ward_id;
      where.ward_id = wardId;

      if (!districtId) where.district_id = ward.district_id;
    }

    const properties = await this.prismaService.property.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        title: true,
        description: true,
        category: {
          select: {
            category_name: true,
          }
        },
        area: true,
        price: true,
        location: true,
        status: true,
        createdAt: true,
        owner: {
          select: {
            name: true,
          }
        },
        images: {
          select: {
            image_id: true,
            imageUrl: true,
            isPrimary: true,
          }
        }
      }
    });

    const total = await this.prismaService.property.count({
      where,
    });

    return returnPaging(properties, total, pagingParams);
  }

  async getOneProperty(propertyId: number) {
    const existProperty = await this.prismaService.property.findFirst({
      where: {
        property_id: propertyId,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            category_name: true,
          }
        },
        owner: {
          select: {
            name: true,
          }
        },
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
        images: {
          select: {
            image_id: true,
            imageUrl: true,
            isPrimary: true,
          }
        },
        PropertyAmenities: {
          select: {
            amenity: {
              select: {
                name: true,
                category: true,
              }
            }
          }
        },
        posts: {},
        deposits: {},
        PropertyUtilities: {
          select: {
            utility: {
              select: {
                utility_name: true,
                utility_category: true,
              }
            }
          }
        },
      }
    })
    if (!existProperty) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Property`,
        HttpStatus.NOT_FOUND,
      )
    }

    return existProperty;
  }

  async createProperty(dto: CreatePropertyDto) {
    const creator = ContextProvider.getAuthUser<User>();
    if (!creator) {
      throw new ApiException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const hasLocs = !!dto.province_id || !!dto.district_id || !!dto.ward_id;
    const hasGeo = dto.lat !== undefined && dto.lon !== undefined;
    if (!hasLocs && !hasGeo) {
      throw new ApiException(
        'Require either location (province/district/ward) or lat/lon',
        HttpStatus.BAD_REQUEST
      );
    }

    const loc = await this.validateLocationIds(dto.province_id, dto.district_id, dto.ward_id);

    return this.prismaService.$transaction(async (prisma) => {
      try {
        const property = await prisma.property.create({
          data: {
            title: dto.title,
            description: dto.description,
            price: dto.price,
            area: dto.area,
            bedroomNumber: dto.bedroomNumber,
            toiletNumber: dto.toiletNumber,
            floorNumber: dto.floorNumber,
            parking: dto.parking,
            orientation: dto.orientation,
            frontage: dto.frontage,
            roadWidth: dto.roadWidth,
            furnitureStatus: dto.furnitureStatus,
            legalStatus: dto.legalStatus,
            yearBuilt: dto.yearBuilt,
            lat: dto.lat,
            lon: dto.lon,
            location: dto.location,
            category_id: dto.category_id,
            owner_id: creator.user_id,
            province_id: loc.province_id ?? null,
            district_id: loc.district_id ?? null,
            ward_id: loc.ward_id ?? null,
            status: dto.status ?? 'ACTIVE',
          },
        });

        // images
        if (dto.images?.length) {
          // đảm bảo chỉ 1 isPrimary
          let primaryMarked = false;
          const imagesData = dto.images.map((img) => {
            const isPrimary = !primaryMarked && img.isPrimary ? true : false;
            if (isPrimary) primaryMarked = true;
            return { property_id: property.property_id, imageUrl: img.imageUrl, isPrimary };
          });
          await prisma.propertyImage.createMany({ data: imagesData, skipDuplicates: true });
          // nếu vẫn chưa có primary, set ảnh đầu tiên làm primary
          if (!primaryMarked) {
            const first = await prisma.propertyImage.findFirst({
              where: { property_id: property.property_id },
              orderBy: { image_id: 'asc' },
              select: { image_id: true },
            });
            if (first) {
              await prisma.propertyImage.update({ where: { image_id: first.image_id }, data: { isPrimary: true } });
            }
          }
        }

        // Amenities
        if (dto.amenity_ids?.length) {
          const amenities = dto.amenity_ids.map((amenity_id) => ({ property_id: property.property_id, amenity_id }));
          for (const amenity of amenities) {
            await prisma.propertyAmenity.upsert({
              where: {
                property_id_amenity_id: {
                  property_id: amenity.property_id,
                  amenity_id: amenity.amenity_id
                },
              },
              update: { deletedAt: null },
              create: {
                property_id: amenity.property_id,
                amenity_id: amenity.amenity_id,
              },
            });
          }
        }

        // Utilities
        if (dto.utilities?.length) {
          for (const u of dto.utilities) {
            await prisma.propertyUtility.upsert({
              where: {
                property_id_utility_id: { property_id: property.property_id, utility_id: u.utility_id },
              },
              update: {
                distance_m: u.distance_m ?? undefined,
                travel_time_s: u.travel_time_s ?? undefined,
                is_primary: u.is_primary ?? undefined,
                note: u.note ?? undefined,
              },
              create: {
                property_id: property.property_id,
                utility_id: u.utility_id,
                distance_m: u.distance_m ?? undefined,
                travel_time_s: u.travel_time_s ?? undefined,
                is_primary: u.is_primary ?? undefined,
                note: u.note ?? undefined,
              },
            });
          }
        }

        const res = await this.prismaService.property.findFirst({
          where: { property_id: property.property_id },
          include: {
            images: true,
            PropertyAmenities: {
              select: {
                amenity: {
                  select: {
                    name: true,
                    category: true,
                  }
                }
              }
            },
            PropertyUtilities: {
              select: {
                utility: {
                  select: {
                    utility_name: true,
                    utility_category: true,
                  }
                }
              }
            },
          },
        });
        return res;
      } catch (error) {
        throw new ApiException(
          `Error creating property: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
    );
  }

  // Chỉ update thông tin property, không update các quan hệ N-N
  async updateProperty(propertyId: number, dto: UpdatePropertyDto) {
    const existProperty = await this.prismaService.property.findFirst({
      where: {
        property_id: propertyId,
      },
    });
    if (!existProperty) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Property`,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      const updatedProperty = await this.prismaService.property.update({
        where: { property_id: propertyId },
        data: {
          title: dto.title ?? existProperty.title,
          description: dto.description ?? existProperty.description,
          price: dto.price ?? existProperty.price,
          area: dto.area ?? existProperty.area,
          bedroomNumber: dto.bedroomNumber ?? existProperty.bedroomNumber,
          toiletNumber: dto.toiletNumber ?? existProperty.toiletNumber,
          floorNumber: dto.floorNumber ?? existProperty.floorNumber,
          parking: dto.parking ?? existProperty.parking,
          orientation: dto.orientation ?? existProperty.orientation,
          frontage: dto.frontage ?? existProperty.frontage,
          roadWidth: dto.roadWidth ?? existProperty.roadWidth,
          furnitureStatus: dto.furnitureStatus ?? existProperty.furnitureStatus,
          legalStatus: dto.legalStatus ?? existProperty.legalStatus,
          yearBuilt: dto.yearBuilt ?? existProperty.yearBuilt,
          lat: dto.lat ?? existProperty.lat,
          lon: dto.lon ?? existProperty.lon,
          location: dto.location ?? existProperty.location,
          status: dto.status ?? existProperty.status,
          category_id: dto.category_id ?? existProperty.category_id,
        },
      });
      return updatedProperty;
    } catch (error) {
      throw new ApiException(
        `Error updating property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteProperty(propertyId: number) {
    const existProperty = await this.prismaService.property.findFirst({
      where: {
        property_id: propertyId,
      },
    });
    if (!existProperty) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Property`,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      return await this.prismaService.$transaction(async (prisma) => {
        await prisma.propertyAmenity.updateMany({
          where: { property_id: propertyId },
          data: { deletedAt: new Date() },
        });
        await prisma.propertyUtility.updateMany({
          where: { property_id: propertyId },
          data: { deletedAt: new Date() },
        });
        return await prisma.property.update({
          where: { property_id: propertyId },
          data: { deletedAt: new Date() },
        });
      });
    } catch (error) {
      throw new ApiException(
        `Error deleting property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeImageFromProperty(propertyId: number, imageId: number) {
    const existProperty = await this.prismaService.property.findFirst({
      where: {
        property_id: propertyId,
      },
    });
    if (!existProperty) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Property`,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      return await this.prismaService.property.update({
        where: { property_id: propertyId },
        data: {
          images: {
            delete: {
              image_id: imageId,
            },
          },
        },
      });
    } catch (error) {
      throw new ApiException(
        `Error removing image from property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addAmenity(propertyId: number, amenityId: number) {
    const existProperty = await this.checkExistProperty(propertyId);

    const existAmenity = await this.checkExistAmenity(amenityId);

    const existAmenityInProperty = await this.prismaService.propertyAmenity.findFirst({
      where: {
        property_id: propertyId,
        amenity_id: amenityId,
      },
    });
    if (existAmenityInProperty && existAmenityInProperty?.deletedAt === null) {
      throw new ApiException(
        `Amenity already exists in Property`,
        HttpStatus.BAD_REQUEST,
      );
    } else if (existAmenityInProperty && existAmenityInProperty?.deletedAt !== null) {
      return await this.prismaService.propertyAmenity.update({
        where: {
          property_id_amenity_id: { property_id: propertyId, amenity_id: amenityId },
        },
        data: { deletedAt: null },
      });
    }

    try {
      return await this.prismaService.propertyAmenity.create({
        data: {
          property_id: propertyId,
          amenity_id: amenityId,
        },
      });
    } catch (error) {
      throw new ApiException(
        `Error adding amenity to property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteAmenity(propertyId: number, amenityId: number) {
    const existProperty = await this.checkExistProperty(propertyId);

    const existAmenity = await this.checkExistAmenity(amenityId);

    try {
      return await this.prismaService.propertyAmenity.update({
        where: {
          property_id_amenity_id: {
            property_id: propertyId,
            amenity_id: amenityId,
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      throw new ApiException(
        `Error deleting amenity from property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addUtility(propertyId: number, utilityId: number) {
    const existProperty = await this.checkExistProperty(propertyId);

    const existUtility = await this.checkExistUtility(utilityId);

    const existUtilityInProperty = await this.prismaService.propertyUtility.findFirst({
      where: {
        property_id: propertyId,
        utility_id: utilityId,
      },
    });

    if (existUtilityInProperty && existUtilityInProperty.deletedAt === null) {
      throw new ApiException(
        `Utility already exists in Property`,
        HttpStatus.BAD_REQUEST,
      );
    } else if (existUtilityInProperty && existUtilityInProperty.deletedAt !== null) {
      return await this.prismaService.propertyUtility.update({
        where: {
          property_id_utility_id: {
            property_id: propertyId,
            utility_id: utilityId,
          }
        },
        data: {
          deletedAt: null,
        }
      })
    }

    try {
      return await this.prismaService.propertyUtility.create({
        data: {
          property_id: propertyId,
          utility_id: utilityId,
        }
      })
    } catch (error) {
      throw new ApiException(
        `Error adding utility to property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteUtility(propertyId: number, utilityId: number) {
    const existProperty = await this.checkExistProperty(propertyId);

    const existUtility = await this.checkExistUtility(utilityId);

    try {
      return await this.prismaService.propertyUtility.update({
        where: {
          property_id_utility_id: {
            property_id: propertyId,
            utility_id: utilityId,
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      throw new ApiException(
        `Error deleting utility from property: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}