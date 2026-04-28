import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { PLANNING_INGEST_JOB, PLANNING_INGEST_QUEUE } from "./planning-ingest-job.constants";
import { PlanningService } from "./planning.service";
import { PlanningIngestJobData } from "./services/planning-ingest-queue.service";

const rawIngestWorkerConcurrency = Number(process.env.PLANNING_INGEST_QUEUE_CONCURRENCY || 2);
const PLANNING_INGEST_WORKER_CONCURRENCY =
  Number.isFinite(rawIngestWorkerConcurrency) && rawIngestWorkerConcurrency > 0
    ? Math.floor(rawIngestWorkerConcurrency)
    : 2;

@Processor(PLANNING_INGEST_QUEUE)
export class PlanningIngestProcessor {
  constructor(private readonly planningService: PlanningService) { }

  @Process({ name: PLANNING_INGEST_JOB, concurrency: PLANNING_INGEST_WORKER_CONCURRENCY })
  async handleIngestDocuments(job: Job<PlanningIngestJobData>) {
    await job.progress(5);
    const result = await this.planningService.executeQueuedPlanningIngest(job.data);
    await job.progress(100);
    return result;
  }
}
