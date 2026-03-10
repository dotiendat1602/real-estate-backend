import { Module } from "@nestjs/common";
import { PlanningController } from "./planning.controller";
import { PlanningService } from "./planning.service";
import { QhkhsddHanoiAdapter } from "./services/qhkhsdd-hanoi.adapter";

@Module({
  imports: [],
  controllers: [PlanningController],
  providers: [PlanningService, QhkhsddHanoiAdapter],
  exports: [PlanningService],
})
export class PlanningModule { }
