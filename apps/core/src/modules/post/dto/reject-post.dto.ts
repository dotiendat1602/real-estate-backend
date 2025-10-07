import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RejectPostDto {
  @ApiProperty({
    description: "Explain why you reject this post",
    example: "forem..."
  })
  @IsNotEmpty()
  @IsString()
  rejectReason: string
}