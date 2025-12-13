import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { LocationService } from "./location.service";
import { Auth } from "libs/utils";
import { Get, HttpCode, HttpStatus, Param, ParseIntPipe } from "@nestjs/common";

@CoreControllers({
  path: 'locations',
  version: '1',
  tag: 'Locations'
})
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
  ) { }

  @Get('provinces')
  @HttpCode(HttpStatus.OK)
  async getAllProvinces() {
    return this.locationService.getAllProvinces();
  }

  @Get('districts/:provinceId')
  @HttpCode(HttpStatus.OK)
  async getDistrictsByProvince(
    @Param('provinceId', ParseIntPipe) provinceId: number
  ) {
    return this.locationService.getDistrictsByProvince(provinceId);
  }

  @Get('wards/:districtId')
  @HttpCode(HttpStatus.OK)
  async getWardsByDistrict(
    @Param('districtId', ParseIntPipe) districtId: number
  ) {
    return this.locationService.getWardsByDistrict(districtId);
  }
}