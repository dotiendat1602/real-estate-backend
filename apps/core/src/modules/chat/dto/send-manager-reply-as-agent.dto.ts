import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SendManagerReplyAsAgentDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Hello, this is a manager reply as agent.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
