import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { PropertyService } from "./property.service";
import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { GetAllPropertyDto } from "./dto/get-all-property.dto";
import { Auth } from "libs/utils";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";

@CoreControllers({
  path: 'property',
  version: '1',
  tag: 'Property'
})
export class PropertyController {
  constructor(
    private readonly propertyService: PropertyService,
  ) { }

  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllProperty(
    @Query() query: GetAllPropertyDto,
  ) {
    return await this.propertyService.getAllProperty(query);
  }

  @Auth()
  @Get(':propertyId')
  @HttpCode(HttpStatus.OK)
  async getOneProperty(
    @Param('propertyId', ParseIntPipe) propertyId: number,
  ) {
    return await this.propertyService.getOneProperty(propertyId);
  }

  @Auth()
  @Post()
  @HttpCode(HttpStatus.OK)
  async createProperty(
    @Body() dto: CreatePropertyDto,
  ) {
    return await this.propertyService.createProperty(dto);
  }

  @Auth()
  @Patch(':propertyId')
  @HttpCode(HttpStatus.OK)
  async updateProperty(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Body() dto: UpdatePropertyDto,
  ) {
    return await this.propertyService.updateProperty(propertyId, dto);
  }

  @Auth()
  @Delete(':propertyId')
  @HttpCode(HttpStatus.OK)
  async deleteProperty(
    @Param('propertyId', ParseIntPipe) propertyId: number,
  ) {
    return await this.propertyService.deleteProperty(propertyId);
  }

  @Auth()
  @Post(':propertyId/add-amenity/:amenityId')
  @HttpCode(HttpStatus.OK)
  async addAmenity(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Param('amenityId', ParseIntPipe) amenityId: number,
  ) {
    return await this.propertyService.addAmenity(propertyId, amenityId);
  }

  @Auth()
  @Delete(':propertyId/delete-amenity/:amenityId')
  @HttpCode(HttpStatus.OK)
  async deleteAmenity(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Param('amenityId', ParseIntPipe) amenityId: number,
  ) {
    return await this.propertyService.deleteAmenity(propertyId, amenityId);
  }

  @Auth()
  @Post(':propertyId/utility/:utilityId')
  @HttpCode(HttpStatus.OK)
  async addUtility(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Param('utilityId', ParseIntPipe) utilityId: number,
  ) {
    return await this.propertyService.addUtility(propertyId, utilityId);
  }

  @Auth()
  @Delete(':propertyId/delete-utility/:utilityId')
  @HttpCode(HttpStatus.OK)
  async deleteUtility(
    @Param('propertyId', ParseIntPipe) propertyId: number,
    @Param('utilityId', ParseIntPipe) utilityId: number,
  ) {
    return await this.propertyService.deleteUtility(propertyId, utilityId);
  }
}