import { Module } from "@nestjs/common";
import { DepositController } from "./deposit.controller";
import { DepositService } from "./deposit.service";

@Module({
  imports: [],
  exports: [DepositService],
  controllers: [DepositController],
  providers: [DepositService],
})
export class DepositModule { }