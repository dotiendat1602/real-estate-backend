import { Module } from "@nestjs/common";
import { AuthorizationService } from "./services/authorization.service";
import { AuthorizationController } from "./authorization.controller";

@Module({
  providers: [AuthorizationService],
  exports: [AuthorizationService],
  controllers: [AuthorizationController],
})
export class AuthorizationModule { }