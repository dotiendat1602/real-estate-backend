import { PartialType } from "@nestjs/swagger";
import { CreatePropertyCategoryDto } from "./create-category.dto";

export class UpdatePropertyCategoryDto extends PartialType(CreatePropertyCategoryDto) { }