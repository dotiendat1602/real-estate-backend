import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class SendMessageChatBotDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Xin chào, tôi cần tư vấn về bất động sản.',
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}
