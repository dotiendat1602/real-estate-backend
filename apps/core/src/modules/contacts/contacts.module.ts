import { Module } from "@nestjs/common";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./services/contacts.service";

@Module({
  imports: [],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule { }