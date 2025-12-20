import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, Contacts } from "@prisma/client";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { ApiException } from "libs/utils/exception";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { CreateContactPublicDto } from "../dto/create-contact-public.dto";
import { GetAllContactsDto, UpdateContactStatusDto } from "../dto/get-all-contacts.dto";

@Injectable()
export class ContactsService {
  constructor(private readonly prismaService: PrismaService) { }

  private DEFAULT_PUBLIC_STATUS = "NEW";

  // =========================
  // PUBLIC: create contact
  // =========================
  async createPublicContact(dto: CreateContactPublicDto) {
    const data: Prisma.ContactsCreateInput = {
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || null,
      topic: dto.topic.trim(),
      subject: dto.subject.trim(),
      message: dto.message.trim(),
      status: this.DEFAULT_PUBLIC_STATUS,
    };

    const created = await this.prismaService.contacts.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        topic: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    });

    return created;
  }

  async getAllContacts(query: GetAllContactsDto) {
    const paging = assignPaging(query);

    const where: Prisma.ContactsWhereInput = { deletedAt: null };

    if (paging.search) {
      const q = paging.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { topic: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
      ];
    }

    if (paging.status) {
      where.status = String(paging.status);
    }

    const orderBy: Prisma.ContactsOrderByWithRelationInput = {
      [paging.sortKey || "createdAt"]: paging.sortOrder || "desc",
    };

    const [items, total] = await Promise.all([
      this.prismaService.contacts.findMany({
        where,
        orderBy,
        skip: paging.skip,
        take: paging.pageSize,
      }),
      this.prismaService.contacts.count({ where }),
    ]);

    return returnPaging(items, total, paging);
  }

  async getContactDetail(id: number) {
    const contact = await this.prismaService.contacts.findFirst({
      where: { id, deletedAt: null },
    });

    if (!contact) {
      throw new ApiException("Contact not found", HttpStatus.NOT_FOUND);
    }
    return contact;
  }

  async updateContactStatus(id: number, dto: UpdateContactStatusDto) {
    const exist = await this.prismaService.contacts.findFirst({
      where: { id, deletedAt: null },
    });
    if (!exist) {
      throw new ApiException("Contact not found", HttpStatus.NOT_FOUND);
    }

    return await this.prismaService.contacts.update({
      where: { id },
      data: { status: dto.status.trim() },
    });
  }

  async deleteContact(id: number) {
    const exist = await this.prismaService.contacts.findUnique({ where: { id } });
    if (!exist) {
      throw new ApiException("Contact not found", HttpStatus.NOT_FOUND);
    }

    return await this.prismaService.contacts.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
