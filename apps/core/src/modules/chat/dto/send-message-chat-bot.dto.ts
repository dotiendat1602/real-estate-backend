import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class SendMessageChatBotDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Tôi muốn tìm căn hộ 3 phòng ngủ ở Hà Nội giá dưới 5 tỷ',
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}
