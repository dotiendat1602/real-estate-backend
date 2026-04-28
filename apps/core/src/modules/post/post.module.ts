import { Module } from "@nestjs/common";
import { PostController } from "./post.controller";
import { PostService } from "./services/post.service";
import { FavoriteService } from "./services/favorite.service";

@Module({
  imports: [],
  exports: [PostService, FavoriteService],
  controllers: [PostController],
  providers: [PostService, FavoriteService]
})
export class PostModule { }