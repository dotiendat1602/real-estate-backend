import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { PostController } from "./post.controller";
import { PostService } from "./services/post.service";
import { FavoriteService } from "./services/favorite.service";
import { POST_INGEST_QUEUE } from "./post-ingest-job.constants";
import { PostIngestProcessor } from "./post-ingest.processor";
import { PostIngestQueueService } from "./services/post-ingest-queue.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: POST_INGEST_QUEUE,
    }),
  ],
  exports: [PostService, FavoriteService],
  controllers: [PostController],
  providers: [PostService, FavoriteService, PostIngestQueueService, PostIngestProcessor]
})
export class PostModule { }
