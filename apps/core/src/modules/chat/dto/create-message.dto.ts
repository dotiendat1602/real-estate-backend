import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    description: 'ID người gửi (buyer/agent)',
    example: 2,
  })
  @IsInt()
  @Min(1)
  senderId: number; // user_id (buyer/agent)

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Hello, I am interested in this property.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
