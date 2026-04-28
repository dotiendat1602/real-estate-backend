import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNumber } from "class-validator";

export class AssignPermissionToRoleDto {
  @ApiProperty({
    description: "Array of permission IDs to assign to the role",
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  permissionIds: number[]
}