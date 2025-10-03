import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiProperty({
    description: "Name of the user",
    example: "Jone",
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}
