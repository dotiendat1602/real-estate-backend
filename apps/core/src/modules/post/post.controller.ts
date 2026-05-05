import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { PostService } from "./services/post.service";
import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { Auth } from "libs/utils";
import { GetAllPostsDto } from "./dto/get-all-post.dto";
import { CreatePostDto, UpdatePostDto } from "./dto/create-post.dto";
import { RejectPostDto } from "./dto/reject-post.dto";
import { SystemPermissionType } from "@prisma/client";
import { ReportPostDto, UpdateReportDto } from "./dto/report-post.dto";
import { FavoriteService } from "./services/favorite.service";
import { GetAllReportDto } from "./dto/get-all-report.dto";
import { BatchApprovePostDto } from "./dto/batch-approve-post.dto";

@CoreControllers({
  path: 'post',
  version: '1',
  tag: 'Post'
})
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly favoriteService: FavoriteService,
  ) { }

  // Endpoint: GET /api/core/v1/post/public
  @Get('public')
  @HttpCode(HttpStatus.OK)
  async getAllPublicPosts(
    @Query() query: GetAllPostsDto,
  ) {
    return await this.postService.getAllPublicPosts(query);
  }

  // Endpoint: GET /api/core/v1/post/public/:postId
  @Get('public/:postId')
  @HttpCode(HttpStatus.OK)
  async getOnePublicPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Query('userId') userId?: number,
  ) {
    return await this.postService.getOnePublicPost(postId, userId);
  }

  // Endpoint: POST /api/core/v1/post/public/:postId/reports
  @Post('public/:postId/reports')
  @HttpCode(HttpStatus.OK)
  async reportPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: ReportPostDto,
  ) {
    return await this.postService.reportPost(postId, dto);
  }

  // Endpoint: GET /api/core/v1/post/reports
  @Auth()
  @Get('reports')
  @HttpCode(HttpStatus.OK)
  async getReports(
    @Query() query: GetAllReportDto,
  ) {
    return await this.postService.getReports(query);
  }

  // Endpoint: PATCH /api/core/v1/post/reports/:id
  @Auth()
  @Patch('reports/:reportId')
  @HttpCode(HttpStatus.OK)
  async updateReport(
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() dto: UpdateReportDto,
  ) {
    return await this.postService.updateReport(reportId, dto);
  }

  // Endpoint: GET /api/core/v1/post/favorites
  @Auth()
  @Get('favorites')
  @HttpCode(HttpStatus.OK)
  async getFavoritesPost(
    @Query() query: GetAllPostsDto,
  ) {
    return await this.favoriteService.getFavoritesPost(query);
  }

  // Endpoint: POST /api/core/v1/post/favorites/:postId
  @Auth()
  @Post('favorites/:postId')
  @HttpCode(HttpStatus.OK)
  async addOrRemoveFavorites(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.favoriteService.addOrRemoveFavorites(postId);
  }

  // Endpoint: GET /api/core/v1/post/my
  @Auth()
  @Get('my')
  @HttpCode(HttpStatus.OK)
  async getMyPosts(
    @Query() query: GetAllPostsDto,
  ) {
    return await this.postService.getMyPosts(query);
  }

  // Endpoint: GET /api/core/v1/post
  @Auth([SystemPermissionType.MANAGE_POST])
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPosts(
    @Query() query: GetAllPostsDto,
  ) {
    return await this.postService.getAllPosts(query);
  }

  // Endpoint: GET /api/core/v1/post/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Get(':postId')
  @HttpCode(HttpStatus.OK)
  async getOnePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.getOnePost(postId);
  }

  // Endpoint: POST /api/core/v1/post
  @Auth([SystemPermissionType.MANAGE_POST])
  @Post()
  @HttpCode(HttpStatus.OK)
  async createPost(
    @Body() dto: CreatePostDto,
  ) {
    return await this.postService.createPost(dto);
  }

  // Endpoint: PATCH /api/core/v1/post/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Patch(":postId")
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: UpdatePostDto,
  ) {
    return await this.postService.updatePost(postId, dto);
  }

  // Endpoint: DELETE /api/core/v1/post/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.deletePost(postId);
  }

  // Endpoint: POST /api/core/v1/post/restore/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Post('restore/:postId')
  @HttpCode(HttpStatus.OK)
  async restorePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.restorePost(postId);
  }

  // Endpoint: POST /api/core/v1/post/approve/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Post('approve/batch')
  @HttpCode(HttpStatus.OK)
  async approvePosts(
    @Body() dto: BatchApprovePostDto,
  ) {
    return await this.postService.approvePosts(dto);
  }

  // Endpoint: POST /api/core/v1/post/approve/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Post('approve/:postId')
  @HttpCode(HttpStatus.OK)
  async approvePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.approvePost(postId);
  }

  // Endpoint: POST /api/core/v1/post/reject/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Post('reject/:postId')
  @HttpCode(HttpStatus.OK)
  async rejectPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: RejectPostDto,
  ) {
    return await this.postService.rejectPost(postId, dto);
  }

  // Endpoint: POST /api/core/v1/post/archive/:postId
  @Auth([SystemPermissionType.MANAGE_POST])
  @Post('archive/:postId')
  @HttpCode(HttpStatus.OK)
  async archivePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.archivePost(postId);
  }
}
