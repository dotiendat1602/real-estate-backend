import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { DefaultPaginationDto } from "libs/utils/pagination/pagination.dto";

export class GetAllContactsDto extends DefaultPaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(["createdAt"])
  sortKey?: "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}

export class UpdateContactStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string; // ví dụ: NEW | IN_PROGRESS | RESOLVED | SPAM
}
