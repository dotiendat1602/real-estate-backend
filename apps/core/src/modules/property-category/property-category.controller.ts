import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { Auth } from "libs/utils";
import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { PropertyCategoryService } from "./property-category.service";
import { GetAllPropertyCategoryDto } from "./dto/get-all-category.dto";
import { CreatePropertyCategoryDto } from "./dto/create-category.dto";
import { UpdatePropertyCategoryDto } from "./dto/update-category.dto";

@CoreControllers({
  path: 'property-category',
  version: '1',
  tag: 'Property Category',
})
export class PropertyCategoryController {
  constructor(
    private readonly propertyCategoryService: PropertyCategoryService,
  ) { }

  // Endpoint: GET /api/core/v1/property-category/meta-data
  @Get('meta-data')
  @HttpCode(HttpStatus.OK)
  async getPropertyCategoryMetaData() {
    return this.propertyCategoryService.getPropertyCategoryMetaData();
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPropertyCategory(
    @Query() dto: GetAllPropertyCategoryDto,
  ) {
    return this.propertyCategoryService.getAllPropertyCategory(dto);
  }

  @Auth()
  @Post()
  @HttpCode(HttpStatus.OK)
  async createPropertyCategory(
    @Body() dto: CreatePropertyCategoryDto,
  ) {
    return this.propertyCategoryService.createPropertyCategory(dto);
  }

  @Auth()
  @Patch(':categoryId')
  @HttpCode(HttpStatus.OK)
  async updatePropertyCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdatePropertyCategoryDto,
  ) {
    return this.propertyCategoryService.updatePropertyCategory(categoryId, dto);
  }

  @Auth()
  @Delete(':categoryId')
  @HttpCode(HttpStatus.OK)
  async deletePropertyCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.propertyCategoryService.deletePropertyCategory(categoryId);
  }
}
