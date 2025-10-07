import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PostStatus, PostType } from "@prisma/client";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";

export class CreatePostDto {
  @ApiProperty({
    description: "Property Id",
    example: "1",
  })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  property_id: number

  @ApiProperty({
    description: "Title of Post",
    example: "Tiêu đề",
  })
  @IsNotEmpty()
  @IsString()
  postTitle: string

  @ApiPropertyOptional({
    description: "Type of Post",
    example: "SALE",
  })
  @IsOptional()
  @IsEnum(PostType)
  postType: PostType

  @ApiPropertyOptional({
    description: "Content of Post",
    example: "Về căn hộ...",
  })
  @IsOptional()
  @IsString()
  postContent?: string

  @ApiProperty({
    description: "Content of Post",
    example: "Về căn hộ...",
  })
  @IsNotEmpty()
  @IsEnum(PostStatus)
  postStatus: PostStatus
}