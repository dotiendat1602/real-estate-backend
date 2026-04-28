import { Module } from "@nestjs/common";
import { LeadController } from "./lead.controller";
import { LeadService } from "./services/lead.service";

@Module({
  imports: [],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule { }