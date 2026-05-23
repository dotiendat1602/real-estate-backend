import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class NewsletterSubscribeDto {
  @ApiProperty({
    description: "Email address to subscribe to weekly news updates",
    example: "reader@example.com",
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
