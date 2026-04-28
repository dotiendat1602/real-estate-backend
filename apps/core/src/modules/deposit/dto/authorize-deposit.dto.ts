import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class AuthorizeDepositDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  transactionRef?: string;

  // TTL tính theo giờ để set holdExpiresAt = now + TTL (optional)
  @IsOptional()
  @IsInt()
  @IsPositive()
  holdTtlHours?: number;
}
