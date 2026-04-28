import { Module } from "@nestjs/common";
import { PropertyCategoryService } from "./property-category.service";
import { PropertyCategoryController } from "./property-category.controller";

@Module({
  imports: [],
  exports: [PropertyCategoryService],
  controllers: [PropertyCategoryController],
  providers: [PropertyCategoryService],
})
export class PropertyCategoryModule { }