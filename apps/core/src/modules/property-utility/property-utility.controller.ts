import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { PropertyUtilityService } from "./property-utility.service";
import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { GetAllPropertyUtilitiesDto } from "./dto/get-all-utility.dto";
import { CreatePropertyUtilityDto } from "./dto/create-utility.dto";
import { Auth } from "libs/utils";
import { UpdatePropertyUtilityDto } from "./dto/update-utility.dto";

@CoreControllers({
  path: 'property-utility',
  version: '1',
  tag: 'Property Utility'
})
export class PropertyUtilityController {
  constructor(
    private readonly propertyUtilityService: PropertyUtilityService,
  ) { }

  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPropertyUtilities(
    @Query() query: GetAllPropertyUtilitiesDto,
  ) {
    return this.propertyUtilityService.getAllPropertyUtilities(query);
  }

  @Auth()
  @Post()
  @HttpCode(HttpStatus.OK)
  async createPropertyUtility(
    @Body() dto: CreatePropertyUtilityDto,
  ) {
    return this.propertyUtilityService.createPropertyUtility(dto);
  }

  @Auth()
  @Patch(':utilityId')
  @HttpCode(HttpStatus.OK)
  async updatePropertyUtility(
    @Param('utilityId', ParseIntPipe) utilityId: number,
    @Body() dto: UpdatePropertyUtilityDto,
  ) {
    return this.propertyUtilityService.updatePropertyUtility(utilityId, dto);
  }

  @Auth()
  @Delete(':utilityId')
  @HttpCode(HttpStatus.OK)
  async deletePropertyUtility(
    @Param('utilityId', ParseIntPipe) utilityId: number,
  ) {
    return this.propertyUtilityService.deletePropertyUtility(utilityId);
  }
}