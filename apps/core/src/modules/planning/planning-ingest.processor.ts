import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { PLANNING_INGEST_JOB, PLANNING_INGEST_QUEUE } from "./planning-ingest-job.constants";
import { PlanningService } from "./planning.service";
import { PlanningIngestJobData } from "./services/planning-ingest-queue.service";

@Processor(PLANNING_INGEST_QUEUE)
export class PlanningIngestProcessor {
  constructor(private readonly planningService: PlanningService) {}

  @Process(PLANNING_INGEST_JOB)
  async handleIngestDocuments(job: Job<PlanningIngestJobData>) {
    await job.progress(5);
    const result = await this.planningService.executeQueuedPlanningIngest(job.data);
    await job.progress(100);
    return result;
  }
}
