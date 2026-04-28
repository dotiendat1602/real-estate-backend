import { Body, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { CoordinateLookupDto } from "./dto/coordinate-lookup.dto";
import { PlanningBatchIngestDto } from "./dto/planning-batch-ingest.dto";
import { PlanningExplainDto } from "./dto/planning-explain.dto";
import { PlanningIngestDto } from "./dto/planning-ingest.dto";
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

  @Post("properties/:propertyId/explain")
  @HttpCode(HttpStatus.OK)
  async getPropertyPlanningExplain(
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Body() dto: PlanningExplainDto,
  ) {
    return await this.planningService.getPropertyPlanningExplain(propertyId, dto);
  }

  @Post("properties/:propertyId/ingest-documents")
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestPropertyPlanningDocuments(
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Body() dto: PlanningIngestDto,
  ) {
    return await this.planningService.ingestPropertyPlanningDocuments(propertyId, dto);
  }

  @Post("properties/ingest-documents/batch")
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestPlanningDocumentsByPropertyIds(@Body() dto: PlanningBatchIngestDto) {
    return await this.planningService.ingestPlanningDocumentsByPropertyIds(dto);
  }

  @Get("properties/:propertyId/ingest-documents/jobs/:jobId")
  @HttpCode(HttpStatus.OK)
  async getIngestPropertyPlanningDocumentsJobStatus(
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Param("jobId") jobId: string,
  ) {
    return await this.planningService.getPlanningIngestJobStatus(propertyId, jobId);
  }
}
