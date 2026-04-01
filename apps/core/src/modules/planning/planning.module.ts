import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { PlanningController } from "./planning.controller";
import { PLANNING_INGEST_QUEUE } from "./planning-ingest-job.constants";
import { PlanningIngestProcessor } from "./planning-ingest.processor";
import { PlanningService } from "./planning.service";
import { PlanningAiClientService } from "./services/planning-ai-client.service";
import { PlanningIngestQueueService } from "./services/planning-ingest-queue.service";
import { QhkhsddHanoiAdapter } from "./services/qhkhsdd-hanoi.adapter";

@Module({
  imports: [
    BullModule.registerQueue({
      name: PLANNING_INGEST_QUEUE,
    }),
  ],
  controllers: [PlanningController],
  providers: [
    PlanningService,
    QhkhsddHanoiAdapter,
    PlanningAiClientService,
    PlanningIngestQueueService,
    PlanningIngestProcessor,
  ],
  exports: [PlanningService],
})
export class PlanningModule { }
