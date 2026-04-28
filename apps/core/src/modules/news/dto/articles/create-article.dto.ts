import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export enum NewsStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
}

export class CreateArticleDto {
  @IsNotEmpty()
  @IsInt()
  topicId: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsInt()
  readMin?: number;

  @IsOptional()
  @IsEnum(NewsStatus)
  status?: NewsStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
