import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job, JobStatus, Queue } from "bull";
import { POST_INGEST_JOB, POST_INGEST_QUEUE } from "../post-ingest-job.constants";

export type PostIngestAction = "upsert" | "delete";
export type PostIngestTrigger = "approve" | "update" | "reject" | "archive" | "delete" | "manual";

export interface PostIngestJobData {
  postId: number;
  action: PostIngestAction;
  trigger: PostIngestTrigger;
  requestedById?: number | null;
}

@Injectable()
export class PostIngestQueueService {
  constructor(@InjectQueue(POST_INGEST_QUEUE) private readonly queue: Queue<PostIngestJobData>) { }

  async enqueue(data: PostIngestJobData): Promise<{ jobId: string; status: string; alreadyQueued: boolean }> {
    const activeJob = await this.findActiveJob(data.postId, data.action);
    if (activeJob) {
      return {
        jobId: String(activeJob.id),
        status: this.mapStateToStatus(await activeJob.getState()),
        alreadyQueued: true,
      };
    }

    const attempts = this.resolvePositiveInt(process.env.POST_INGEST_QUEUE_ATTEMPTS, 3);
    const job = await this.queue.add(POST_INGEST_JOB, data, {
      attempts,
      backoff: {
        type: "exponential",
        delay: this.resolvePositiveInt(process.env.POST_INGEST_QUEUE_BACKOFF_MS, 5000),
      },
      removeOnComplete: this.resolvePositiveInt(process.env.POST_INGEST_QUEUE_REMOVE_ON_COMPLETE, 500),
      removeOnFail: this.resolvePositiveInt(process.env.POST_INGEST_QUEUE_REMOVE_ON_FAIL, 500),
      priority: data.trigger === "manual" ? 1 : 2,
    });

    return {
      jobId: String(job.id),
      status: "queued",
      alreadyQueued: false,
    };
  }

  private async findActiveJob(postId: number, action: PostIngestAction): Promise<Job<PostIngestJobData> | null> {
    const jobs = await this.queue.getJobs(["active", "waiting", "delayed"], 0, 500, true);
    return jobs.find((job) => Number(job?.data?.postId) === Number(postId) && job?.data?.action === action) || null;
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

  private resolvePositiveInt(raw: string | undefined, fallback: number): number {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
