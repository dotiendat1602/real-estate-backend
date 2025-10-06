import { Module } from "@nestjs/common";
import { PropertyUtilityService } from "./property-utility.service";
import { PropertyUtilityController } from "./property-utility.controller";

@Module({
  imports: [],
  exports: [PropertyUtilityService],
  controllers: [PropertyUtilityController],
  providers: [PropertyUtilityService],
})
export class PropertyUtilityModule { }