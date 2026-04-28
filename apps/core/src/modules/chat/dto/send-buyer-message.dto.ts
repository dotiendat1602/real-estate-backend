import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class SendBuyerMessageDto {
  @ApiPropertyOptional({
    description: 'ID của bài đăng',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  postId: number;

  @ApiProperty({
    description: 'ID của agent',
    example: 2,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  agentId: number;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Hello, I am interested in this property.',
  })
  @IsNotEmpty()
  @IsString()
  content: string;
}
