import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { AmenityService } from "./amenity.service";
import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { GetAllAmenityDto } from "./dto/get-all-amenity.dto";
import { CreateAmenityDto } from "./dto/create-amenity.dto";
import { UpdateAmenityDto } from "./dto/update-amenity.dto";
import { Auth } from "libs/utils";

@CoreControllers({
  path: 'amenity',
  version: '1',
  tag: 'Amenity',
})
export class AmenityController {
  constructor(
    private readonly amenityService: AmenityService,
  ) { }

  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllAmenities(
    @Query() query: GetAllAmenityDto,
  ) {
    return this.amenityService.getAllAmenities(query);
  }

  @Auth()
  @Post()
  @HttpCode(HttpStatus.OK)
  async createAmenity(
    @Body() dto: CreateAmenityDto,
  ) {
    return this.amenityService.createAmenity(dto);
  }

  @Auth()
  @Patch(':amenityId')
  @HttpCode(HttpStatus.OK)
  async updateAmenity(
    @Param('amenityId', ParseIntPipe) amenityId: number,
    @Body() dto: UpdateAmenityDto,
  ) {
    return this.amenityService.updateAmenity(amenityId, dto);
  }

  @Auth()
  @Delete(':amenityId')
  @HttpCode(HttpStatus.OK)
  async createAmenities(
    @Param('amenityId', ParseIntPipe) amenityId: number,
  ) {
    return this.amenityService.deleteAmenity(amenityId);
  }
}