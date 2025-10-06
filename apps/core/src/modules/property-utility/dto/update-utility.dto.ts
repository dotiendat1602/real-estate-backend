import { PartialType } from "@nestjs/swagger";
import { CreatePropertyUtilityDto } from "./create-utility.dto";

export class UpdatePropertyUtilityDto extends PartialType(CreatePropertyUtilityDto) { }