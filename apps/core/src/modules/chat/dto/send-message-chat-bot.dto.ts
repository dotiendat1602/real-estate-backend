import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendMessageChatBotDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Tôi muốn tìm căn hộ 3 phòng ngủ ở Hà Nội giá dưới 5 tỷ',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({
    description: 'ID bài đăng hiện tại nếu người dùng đang chat từ trang chi tiết',
    example: 4553,
    required: false,
  })
  @IsOptional()
  @IsInt()
  postId?: number;
}
