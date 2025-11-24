import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class UpdateDepositDto {
  @ApiPropertyOptional({
    description: "Change the hold expires",
    example: "",
  })
  @IsOptional()
  @IsDateString()
  holdExpiresAt?: Date

  @ApiPropertyOptional({
    description: "Note about this deposit",
    example: "",
  })
  @IsOptional()
  @IsString()
  note?: string
}
