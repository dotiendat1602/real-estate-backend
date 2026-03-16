import { Module } from "@nestjs/common";
import { PlanningController } from "./planning.controller";
import { PlanningService } from "./planning.service";
import { PlanningAiClientService } from "./services/planning-ai-client.service";
import { QhkhsddHanoiAdapter } from "./services/qhkhsdd-hanoi.adapter";

@Module({
  imports: [],
  controllers: [PlanningController],
  providers: [PlanningService, QhkhsddHanoiAdapter, PlanningAiClientService],
  exports: [PlanningService],
})
export class PlanningModule { }
