import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsOptional, IsString } from "class-validator";

export class UpdateDepositDto {
  @ApiPropertyOptional({
    description: "Change the hold expires",
    example: "",
  })
  @IsOptional()
  @IsDate()
  holdExpiresAt?: Date

  @ApiPropertyOptional({
    description: "Note about this deposit",
    example: "",
  })
  @IsOptional()
  @IsString()
  note?: string
}