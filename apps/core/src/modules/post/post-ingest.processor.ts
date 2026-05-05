import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import { POST_INGEST_JOB, POST_INGEST_QUEUE } from "./post-ingest-job.constants";
import { PostService } from "./services/post.service";
import { PostIngestJobData } from "./services/post-ingest-queue.service";

const rawConcurrency = Number(process.env.POST_INGEST_QUEUE_CONCURRENCY || 2);
const POST_INGEST_WORKER_CONCURRENCY =
  Number.isFinite(rawConcurrency) && rawConcurrency > 0
    ? Math.floor(rawConcurrency)
    : 2;

@Processor(POST_INGEST_QUEUE)
export class PostIngestProcessor {
  constructor(private readonly postService: PostService) { }

  @Process({ name: POST_INGEST_JOB, concurrency: POST_INGEST_WORKER_CONCURRENCY })
  async handlePostIngest(job: Job<PostIngestJobData>) {
    await job.progress(5);
    const result = await this.postService.executeQueuedPostIngest(job.data);
    await job.progress(100);
    return result;
  }
}
