import { InjectQueue } from "@nestjs/bull";
import { HttpStatus, Injectable } from "@nestjs/common";
import { Job, JobStatus, Queue } from "bull";
import { ApiException } from "libs/utils/exception";
import { PlanningAiIngestRequest } from "./planning-ai-client.service";
import { PLANNING_INGEST_JOB, PLANNING_INGEST_QUEUE } from "../planning-ingest-job.constants";

export interface PlanningIngestJobData {
  propertyId: number;
  dossierCode: string | null;
  replaceExisting: boolean;
  totalDocuments: number;
  ingestRequest: PlanningAiIngestRequest;
  trigger: "manual" | "auto_explain";
}

@Injectable()
export class PlanningIngestQueueService {
  constructor(@InjectQueue(PLANNING_INGEST_QUEUE) private readonly queue: Queue<PlanningIngestJobData>) { }

  async enqueue(data: PlanningIngestJobData): Promise<{ jobId: string; status: string; alreadyQueued: boolean }> {
    const activeJob = await this.findActiveJobByProperty(data.propertyId);
    if (activeJob) {
      return {
        jobId: String(activeJob.id),
        status: this.mapStateToStatus(await activeJob.getState()),
        alreadyQueued: true,
      };
    }

    const job = await this.queue.add(PLANNING_INGEST_JOB, data, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
      priority: data.trigger === "manual" ? 1 : 5,
    });

    return {
      jobId: String(job.id),
      status: "queued",
      alreadyQueued: false,
    };
  }

  async getStatus(propertyId: number, jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new ApiException("Khong tim thay ingest job", HttpStatus.NOT_FOUND);
    }

    const jobData = job.data as PlanningIngestJobData;
    if (Number(jobData?.propertyId) !== Number(propertyId)) {
      throw new ApiException("Khong tim thay ingest job cho bat dong san", HttpStatus.NOT_FOUND);
    }

    const state = await job.getState();
    const status = this.mapStateToStatus(state);

    return {
      jobId: String(job.id),
      queue: PLANNING_INGEST_QUEUE,
      status,
      state,
      propertyId: jobData.propertyId,
      dossierCode: jobData.dossierCode,
      replaceExisting: jobData.replaceExisting,
      totalDocuments: jobData.totalDocuments,
      trigger: jobData.trigger,
      attemptsMade: job.attemptsMade,
      progress: typeof job.progress() === "number" ? job.progress() : 0,
      failedReason: job.failedReason || null,
      createdAt: this.toIsoOrNull(job.timestamp),
      processedAt: this.toIsoOrNull(job.processedOn),
      finishedAt: this.toIsoOrNull(job.finishedOn),
      result: status === "completed" ? (job.returnvalue || null) : null,
    };
  }

  private async findActiveJobByProperty(propertyId: number): Promise<Job<PlanningIngestJobData> | null> {
    const jobs = await this.queue.getJobs(["active", "waiting", "delayed"], 0, 100, true);
    const found = jobs.find((job) => Number(job?.data?.propertyId) === Number(propertyId));
    return found || null;
  }

  private mapStateToStatus(state: JobStatus | string): string {
    switch (state) {
      case "completed":
        return "completed";
      case "failed":
        return "failed";
      case "active":
        return "processing";
      case "waiting":
      case "delayed":
      case "paused":
      default:
        return "queued";
    }
  }

  private toIsoOrNull(value?: number): string | null {
    if (!value || Number.isNaN(Number(value))) {
      return null;
    }

    return new Date(Number(value)).toISOString();
  }
}
