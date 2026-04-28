import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

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

  @ApiPropertyOptional({
    description: "Property ID ưu tiên để chatbot phân tích quy hoạch",
    example: 101,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  propertyId?: number;

  @ApiPropertyOptional({
    description: "Danh sách property IDs để chatbot so sánh quy hoạch",
    example: [101, 205],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  comparePropertyIds?: number[];
}
