import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class DeleteFileDto {
  @ApiProperty({
    description: 'The URL of the file to be deleted',
    example: 'https://salon-step-bucket.s3.ap-southeast-1.amazonaws.com/1760605276729-amela.jpg',
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}