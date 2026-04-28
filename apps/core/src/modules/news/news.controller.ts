// d:\Real-estate\real-estate-backend\apps\core\src\modules\news\news.controller.ts
import { Body, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from "@nestjs/common";
import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { NewsArticleService } from "./service/news-article.service";
import { NewsTopicService } from "./service/news-topic.service";
import { CreateTopicDto } from "./dto/topics/create-topic.dto";
import { Auth } from "libs/utils";
import { UpdateTopicDto } from "./dto/topics/update-topic.dto";
import { CreateArticleDto } from "./dto/articles/create-article.dto";
import { GetAllArticleDto } from "./dto/articles/get-all-article.dto";
import { UpdateArticleDto } from "./dto/articles/update-article.dto";

@CoreControllers({
  path: "news",
  version: "1",
  tag: "News",
})
export class NewsController {
  constructor(
    private readonly newsArticleService: NewsArticleService,
    private readonly newsTopicService: NewsTopicService,
  ) { }

  // ==================== TOPICS ====================

  @Auth()
  @Post("topics")
  createTopic(@Body() createTopicDto: CreateTopicDto) {
    return this.newsTopicService.create(createTopicDto);
  }

  @Get("topics")
  getAllTopics() {
    return this.newsTopicService.getAll();
  }

  @Get("topics/:id")
  getOneTopic(
    @Param("id", ParseIntPipe) id: number
  ) {
    return this.newsTopicService.getOne(id);
  }

  @Auth()
  @Put("topics/:id")
  updateTopic(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateTopicDto: UpdateTopicDto,
  ) {
    return this.newsTopicService.update(id, updateTopicDto);
  }

  @Auth()
  @Delete("topics/:id")
  removeTopic(@Param("id", ParseIntPipe) id: number) {
    return this.newsTopicService.deleteTopic(id);
  }

  // ==================== ARTICLES ====================

  @Auth()
  @Post("articles")
  createArticle(@Body() createArticleDto: CreateArticleDto) {
    return this.newsArticleService.create(createArticleDto);
  }

  @Get("articles")
  getAllArticles(@Query() query: GetAllArticleDto) {
    return this.newsArticleService.getAll(query);
  }

  @Get("articles/:id")
  getOneArticle(@Param("id", ParseIntPipe) id: number) {
    return this.newsArticleService.getOne(id);
  }

  @Auth()
  @Put("articles/:id")
  updateArticle(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.newsArticleService.update(id, updateArticleDto);
  }

  @Auth()
  @Delete("articles/:id")
  removeArticle(@Param("id", ParseIntPipe) id: number) {
    return this.newsArticleService.deleteArticle(id);
  }

  @Auth()
  @Patch("articles/:id/toggle-featured")
  toggleFeatured(@Param("id", ParseIntPipe) id: number) {
    return this.newsArticleService.toggleFeatured(id);
  }

  @Auth()
  @Patch("articles/:id/publish")
  publishArticle(@Param("id", ParseIntPipe) id: number) {
    return this.newsArticleService.publish(id);
  }

  @Auth()
  @Patch("articles/:id/unpublish")
  unpublishArticle(@Param("id", ParseIntPipe) id: number) {
    return this.newsArticleService.unpublish(id);
  }


  // Saved articles
  @Auth()
  @Post("articles/:id/toggle-save")
  toggleSaveArticle(@Param("id", ParseIntPipe) id: number) {
    return this.newsArticleService.toggleSave(id);
  }

  @Auth()
  @Get("saved-articles")
  getAllSavedArticles() {
    return this.newsArticleService.getAllSavedArticles();
  }
}
