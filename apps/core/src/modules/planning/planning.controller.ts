import { Body, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { CoordinateLookupDto } from "./dto/coordinate-lookup.dto";
import { PlanningService } from "./planning.service";

@CoreControllers({
  path: "planning",
  version: "1",
  tag: "Planning",
})
export class PlanningController {
  constructor(private readonly planningService: PlanningService) { }

  @Post("lookups/coordinate")
  @HttpCode(HttpStatus.OK)
  async lookupByCoordinate(@Body() dto: CoordinateLookupDto) {
    return await this.planningService.lookupByCoordinate(dto);
  }

  @Get("properties/:propertyId/summary")
  @HttpCode(HttpStatus.OK)
  async getPropertyPlanningSummary(@Param("propertyId", ParseIntPipe) propertyId: number) {
    return await this.planningService.getPropertyPlanningSummary(propertyId);
  }

  @Get("properties/:propertyId/map")
  @HttpCode(HttpStatus.OK)
  async getPropertyPlanningMap(@Param("propertyId", ParseIntPipe) propertyId: number) {
    return await this.planningService.getPropertyPlanningMap(propertyId);
  }

  @Get("dossiers/:maHoSo")
  @HttpCode(HttpStatus.OK)
  async getPlanningDossier(@Param("maHoSo") maHoSo: string) {
    return await this.planningService.getPlanningDossier(maHoSo);
  }
}
