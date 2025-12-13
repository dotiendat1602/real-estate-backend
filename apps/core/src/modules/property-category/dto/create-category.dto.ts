import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreatePropertyCategoryDto {
  @ApiProperty({
    description: "Name of the property's category",
    example: 'Thương mại',
  })
  @IsNotEmpty()
  @IsString()
  categoryName: string

  @ApiProperty({
    description: "Description of the property's category",
    example: 'Dành cho các tòa nhà văn phòng, TTTM, v.v.',
  })
  @IsOptional()
  @IsString()
  categoryDescription: string
}