import { ApiProperty } from "@nestjs/swagger";
import { AmenityCategory } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateAmenityDto {
  @ApiProperty({
    description: "Name of the amenity of property",
    example: "Ban công",
  })
  @IsNotEmpty()
  @IsString()
  name: string

  @ApiProperty({
    description: "Category of the amenity",
    example: "HOUSEHOLD",
  })
  @IsNotEmpty()
  @IsEnum(AmenityCategory)
  category: AmenityCategory
}