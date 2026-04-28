import { Module } from "@nestjs/common";
import { NewsController } from "./news.controller";
import { NewsArticleService } from "./service/news-article.service";
import { NewsTopicService } from "./service/news-topic.service";

@Module({
  imports: [],
  providers: [NewsArticleService, NewsTopicService],
  controllers: [NewsController],
})
export class NewsModule { }