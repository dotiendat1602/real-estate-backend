import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { PostService } from "./post.service";
import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { Auth } from "libs/utils";
import { GetAllPostsDto } from "./dto/get-all-post.dto";
import { CreatePostDto, UpdatePostDto } from "./dto/create-post.dto";
import { RejectPostDto } from "./dto/reject-post.dto";

@CoreControllers({
  path: 'post',
  version: '1',
  tag: 'Post'
})
export class PostController {
  constructor(
    private readonly postService: PostService,
  ) { }

  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPosts(
    @Query() query: GetAllPostsDto,
  ) {
    return await this.postService.getAllPosts(query);
  }

  @Auth()
  @Get(':postId')
  @HttpCode(HttpStatus.OK)
  async getOnePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.getOnePost(postId);
  }

  @Auth()
  @Post()
  @HttpCode(HttpStatus.OK)
  async createPost(
    @Body() dto: CreatePostDto,
  ) {
    return await this.postService.createPost(dto);
  }

  @Auth()
  @Patch(":postId")
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: UpdatePostDto,
  ) {
    return await this.postService.updatePost(postId, dto);
  }

  @Auth()
  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.deletePost(postId);
  }

  @Auth()
  @Post('restore/:postId')
  @HttpCode(HttpStatus.OK)
  async restorePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.restorePost(postId);
  }

  @Auth()
  @Post('approve/:postId')
  @HttpCode(HttpStatus.OK)
  async approvePost(
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.postService.approvePost(postId);
  }

  @Auth()
  @Post('reject/:postId')
  @HttpCode(HttpStatus.OK)
  async rejectPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: RejectPostDto,
  ) {
    return await this.postService.rejectPost(postId, dto);
  }
}