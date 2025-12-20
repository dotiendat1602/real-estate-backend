import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { ContactsService } from "./services/contacts.service";
import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { Auth } from "libs/utils/decorators/http.decorator";
import { GetAllContactsDto, UpdateContactStatusDto } from "./dto/get-all-contacts.dto";
import { CreateContactPublicDto } from "./dto/create-contact-public.dto";

@CoreControllers({
  path: 'contacts',
  version: '1',
  tag: 'Contact',
})
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) { }

  @Post()
  async createContact(@Body() dto: CreateContactPublicDto) {
    return await this.contactsService.createPublicContact(dto);
  }

  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAll(@Query() query: GetAllContactsDto) {
    return await this.contactsService.getAllContacts(query);
  }

  @Auth()
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getDetail(@Param("id", ParseIntPipe) id: number) {
    return await this.contactsService.getContactDetail(id);
  }

  @Auth()
  @Patch(":id/status")
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateContactStatusDto,
  ) {
    return await this.contactsService.updateContactStatus(id, dto);
  }

  @Auth()
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async deleteContact(@Param("id", ParseIntPipe) id: number) {
    return await this.contactsService.deleteContact(id);
  }
}
