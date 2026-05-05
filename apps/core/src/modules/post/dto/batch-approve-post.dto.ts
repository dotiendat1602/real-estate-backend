import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from "class-validator";

export class BatchApprovePostDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  postIds: number[];
}
