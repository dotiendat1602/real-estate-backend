import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class SendMessageChatBotDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Tôi muốn tìm căn hộ 3 phòng ngủ ở Hà Nội giá dưới 5 tỷ',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Số lượng kết quả tìm kiếm (1-50)',
    example: 12,
    default: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number = 12;
}
