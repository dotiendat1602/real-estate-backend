import { IsOptional, IsString, MaxLength } from "class-validator";

export class PlanningExplainDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  question?: string;
}
