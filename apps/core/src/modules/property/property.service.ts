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
      where: { id: propertyId, deletedAt: null },
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
      where: { id: amenityId, deletedAt: null },
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
      where: { id: utilityId, deletedAt: null },
    });
    if (!existUtility) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Utility`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async validateLocationIds(
    provinceId?: number,
    districtId?: number,
    wardId?: number,
  ) {
    if (wardId && !districtId) {
      throw new ApiException('Ward requires districtId', HttpStatus.BAD_REQUEST);
    }
    if (districtId && !provinceId) {
      throw new ApiException('District requires provinceId', HttpStatus.BAD_REQUEST);
    }

    let province: { id: number } | null = null;
    let district: { id: number; provinceId: number } | null = null;
    let ward: { id: number; districtId: number } | null = null;

    if (provinceId) {
      province = await this.prismaService.province.findUnique({
        where: { id: provinceId },
        select: { id: true },
      });
      if (!province) {
        throw new ApiException(
          'Province not found',
          HttpStatus.NOT_FOUND
        );
      }
    }

    if (districtId) {
      district = await this.prismaService.district.findUnique({
        where: { id: districtId },
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

    if (wardId) {
      ward = await this.prismaService.ward.findUnique({
        where: { id: wardId },
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
      provinceId: province?.id,
      districtId: district?.id,
      wardId: ward?.id
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
    if (pagingParams.provinceId) {
      const province = await this.prismaService.province.findUnique({
        where: {
          id: pagingParams.provinceId,
        },
        select: { id: true },
      });
      if (!province) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: Province`,
          HttpStatus.NOT_FOUND,
        )
      }

      provinceId = province.id;
      where.provinceId = provinceId;
    }

    // check district
    if (pagingParams.districtId) {
      const district = await this.prismaService.district.findFirst({
        where: {
          id: pagingParams.districtId,
          ...(provinceId ? { provinceId: provinceId } : {}),
        },
        select: { id: true, provinceId: true },
      });
      if (!district) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: District`,
          HttpStatus.NOT_FOUND,
        )
      }

      districtId = district.id;
      // Nếu chưa có provinceId mà district có, cũng gán where.provinceId
      where.districtId = districtId;
      if (!provinceId) where.provinceId = district.provinceId;
    }

    // check ward
    if (pagingParams.wardId) {
      const ward = await this.prismaService.ward.findFirst({
        where: {
          id: pagingParams.wardId,
          ...(districtId ? { districtId: districtId } : {}),
        },
        select: { id: true, districtId: true },
      });
      if (!ward) {
        throw new ApiException(
          `${ItemMessage.NOT_FOUND}: Ward`,
          HttpStatus.NOT_FOUND,
        )
      }

      wardId = ward.id;
      where.wardId = wardId;

      if (!districtId) where.districtId = ward.districtId;
    }

    const [properties, total] = await Promise.all([
      await this.prismaService.property.findMany({
        where,
        orderBy: orderObject,
        skip: pagingParams.skip,
        take: pagingParams.pageSize,
        include: {
          category: {
            select: {
              categoryName: true,
            }
          },
          owner: {
            select: {
              name: true,
            }
          },
          ward: {
            select: {
              id: true,
              name: true,
            }
          },
          district: {
            select: {
              id: true,
              name: true,
            }
          },
          province: {
            select: {
              id: true,
              name: true,
            }
          },
          images: {
            select: {
              id: true,
              imageUrl: true,
              isPrimary: true,
            }
          },
          propertyAmenities: {
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
          propertyUtilities: {
            include: {
              utility: {
                select: {
                  utilityName: true,
                  utilityCategory: true,
                }
              }
            }
          },
        }
      }),

      await this.prismaService.property.count({ where }),
    ]);
    return returnPaging(properties, total, pagingParams);
  }

  async getOneProperty(propertyId: number) {
    const existProperty = await this.prismaService.property.findFirst({
      where: {
        id: propertyId,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            categoryName: true,
          }
        },
        owner: {
          select: {
            name: true,
          }
        },
        ward: {
          select: {
            id: true,
            name: true,
          }
        },
        district: {
          select: {
            id: true,
            name: true,
          }
        },
        province: {
          select: {
            id: true,
            name: true,
          }
        },
        images: {
          select: {
            id: true,
            imageUrl: true,
            isPrimary: true,
          }
        },
        propertyAmenities: {
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
        propertyUtilities: {
          include: {
            utility: {
              select: {
                utilityName: true,
                utilityCategory: true,
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

    const hasLocs = !!dto.provinceId || !!dto.districtId || !!dto.wardId;
    const hasGeo = dto.lat !== undefined && dto.lon !== undefined;
    if (!hasLocs && !hasGeo) {
      throw new ApiException(
        'Require either location (province/district/ward) or lat/lon',
        HttpStatus.BAD_REQUEST
      );
    }

    const loc = await this.validateLocationIds(dto.provinceId, dto.districtId, dto.wardId);

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
            categoryId: dto.categoryId,
            ownerId: creator.id,
            provinceId: loc.provinceId ?? null,
            districtId: loc.districtId ?? null,
            wardId: loc.wardId ?? null,
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
            return { propertyId: property.id, imageUrl: img.imageUrl, isPrimary };
          });
          await prisma.propertyImage.createMany({ data: imagesData, skipDuplicates: true });
          // nếu vẫn chưa có primary, set ảnh đầu tiên làm primary
          if (!primaryMarked) {
            const first = await prisma.propertyImage.findFirst({
              where: { propertyId: property.id },
              orderBy: { id: 'asc' },
              select: { id: true },
            });
            if (first) {
              await prisma.propertyImage.update({ where: { id: first.id }, data: { isPrimary: true } });
            }
          }
        }

        // Amenities
        if (dto.amenityIds?.length) {
          const amenities = dto.amenityIds.map((amenityId) => ({ propertyId: property.id, amenityId }));
          for (const amenity of amenities) {
            await prisma.propertyAmenity.upsert({
              where: {
                propertyId_amenityId: {
                  propertyId: amenity.propertyId,
                  amenityId: amenity.amenityId
                },
              },
              update: { deletedAt: null },
              create: {
                propertyId: amenity.propertyId,
                amenityId: amenity.amenityId,
              },
            });
          }
        }

        // Utilities
        if (dto.utilities?.length) {
          for (const u of dto.utilities) {
            await prisma.propertyUtility.upsert({
              where: {
                propertyId_utilityId: { propertyId: property.id, utilityId: u.id },
              },
              update: {
                distanceM: u.distanceM ?? undefined,
                travelTimeS: u.travelTimeS ?? undefined,
                isPrimary: u.isPrimary ?? undefined,
                note: u.note ?? undefined,
              },
              create: {
                propertyId: property.id,
                utilityId: u.id,
                distanceM: u.distanceM ?? undefined,
                travelTimeS: u.travelTimeS ?? undefined,
                isPrimary: u.isPrimary ?? undefined,
                note: u.note ?? undefined,
              },
            });
          }
        }

        const res = await this.prismaService.property.findFirst({
          where: { id: property.id },
          include: {
            category: {
              select: {
                categoryName: true,
              }
            },
            owner: {
              select: {
                name: true,
              }
            },
            ward: {
              select: {
                id: true,
                name: true,
              }
            },
            district: {
              select: {
                id: true,
                name: true,
              }
            },
            province: {
              select: {
                id: true,
                name: true,
              }
            },
            images: {
              select: {
                id: true,
                imageUrl: true,
                isPrimary: true,
              }
            },
            propertyAmenities: {
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
            propertyUtilities: {
              include: {
                utility: {
                  select: {
                    utilityName: true,
                    utilityCategory: true,
                  }
                }
              }
            },
          }
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
        id: propertyId,
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
        where: { id: propertyId },
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
          categoryId: dto.categoryId ?? existProperty.categoryId,
        },
        include: {
          category: {
            select: {
              categoryName: true,
            }
          },
          owner: {
            select: {
              name: true,
            }
          },
          ward: {
            select: {
              id: true,
              name: true,
            }
          },
          district: {
            select: {
              id: true,
              name: true,
            }
          },
          province: {
            select: {
              id: true,
              name: true,
            }
          },
          images: {
            select: {
              id: true,
              imageUrl: true,
              isPrimary: true,
            }
          },
          propertyAmenities: {
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
          propertyUtilities: {
            include: {
              utility: {
                select: {
                  utilityName: true,
                  utilityCategory: true,
                }
              }
            }
          },
        }
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
        id: propertyId,
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
          where: { propertyId: propertyId },
          data: { deletedAt: new Date() },
        });
        await prisma.propertyUtility.updateMany({
          where: { propertyId: propertyId },
          data: { deletedAt: new Date() },
        });
        return await prisma.property.update({
          where: { id: propertyId },
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
        id: propertyId,
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
        where: { id: propertyId },
        data: {
          images: {
            delete: {
              id: imageId,
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
        propertyId: propertyId,
        amenityId: amenityId,
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
          propertyId_amenityId: { propertyId: propertyId, amenityId: amenityId },
        },
        data: { deletedAt: null },
      });
    }

    try {
      return await this.prismaService.propertyAmenity.create({
        data: {
          propertyId: propertyId,
          amenityId: amenityId,
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
          propertyId_amenityId: {
            propertyId: propertyId,
            amenityId: amenityId,
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
        propertyId: propertyId,
        utilityId: utilityId,
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
          propertyId_utilityId: {
            propertyId: propertyId,
            utilityId: utilityId,
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
          propertyId: propertyId,
          utilityId: utilityId,
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
          propertyId_utilityId: {
            propertyId: propertyId,
            utilityId: utilityId,
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