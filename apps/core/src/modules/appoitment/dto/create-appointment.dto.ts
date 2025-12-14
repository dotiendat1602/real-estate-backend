import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateAppointmentDto {
  @ApiProperty({
    description: "Post ID for which the appointment is being made",
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  postId: number;

  @ApiProperty({
    description: "Buyer ID for whom the appointment is being made",
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  buyerId: number;

  @ApiProperty({
    description: "Scheduled date and time for the appointment in ISO format",
    example: "2024-12-31T10:00:00Z",
  })
  @IsNotEmpty()
  @IsString()
  scheduledAt: string;

  @ApiProperty({
    description: "Location of the appointment",
    example: "123 Main St, Springfield",
  })
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiProperty({
    description: "Additional notes for the appointment",
    example: "Please arrive 10 minutes early.",
  })
  @IsNotEmpty()
  @IsString()
  notes: string;
}
