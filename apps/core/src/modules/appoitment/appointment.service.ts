import { HttpStatus, Injectable } from "@nestjs/common";
import { AppointmentStatus, Prisma, User } from "@prisma/client";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { ApiException } from "libs/utils/exception";
import { ContextProvider } from "libs/utils/providers/context.provider";
import { GetAllAppointmentsDto } from "./dto/get-all-appointment.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { ItemMessage } from "libs/utils/enum";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";

const SORT_WHITELIST: Record<string, keyof Prisma.AppointmentOrderByWithRelationInput> = {
  scheduledAt: 'scheduledAt',
  status: 'status',
};

@Injectable()
export class AppointmentService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  private ensureSort(orderKey?: string, sortOrder?: 'asc' | 'desc') {
    const key = orderKey && SORT_WHITELIST[orderKey] ? SORT_WHITELIST[orderKey] : 'createdAt';
    const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';
    return { [key]: order } as Prisma.AppointmentOrderByWithRelationInput;
  }

  private async logAudit(
    action: string,
    entityId: number,
    payload?: Record<string, any>,
  ) {
    const actor = ContextProvider.getAuthUser<User>();
    if (!actor) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }
    await this.prismaService.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: 'Deposit',
        entityId,
        payload: payload ?? {},
      },
    });
  }

  async getAllAppointments(query: GetAllAppointmentsDto) {
    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
    }

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        {
          post: { postTitle: { contains: q, mode: 'insensitive' } },
        },
        {
          agent: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ]
          }
        },
        {
          buyer: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ]
          },
        },
      ]
    }

    if (pagingParams.date_from || pagingParams.date_to) {
      where.createdAt = {};
      if (pagingParams.date_from) (where.createdAt as any).gte = new Date(pagingParams.date_from);
      if (pagingParams.date_to) (where.createdAt as any).lte = new Date(pagingParams.date_to);
    }

    if (pagingParams.status) {
      Object.assign(where, {
        status: pagingParams.status,
      })
    }

    const appointments = await this.prismaService.appointment.findMany({
      where,
      orderBy,
      take: pagingParams.pageSize,
      skip: pagingParams.skip,
      select: {
        id: true,
        post: {
          select: {
            id: true,
            postTitle: true,
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        },
        scheduledAt: true,
        location: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    const total = await this.prismaService.appointment.count({ where });

    return returnPaging(appointments, total, pagingParams);
  }

  async getOneAppointment(appointmentId: number) {
    const existAppointment = await this.prismaService.appointment.findFirst({
      where: {
        id: appointmentId,
        deletedAt: null,
      },
      include: {
        post: {
          select: {
            id: true,
            postTitle: true,
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          }
        },
      }
    })
    if (!existAppointment) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Appointment #Id${appointmentId}`,
        HttpStatus.NOT_FOUND,
      )
    }
    return existAppointment;
  }

  async updateAppointment(appointmentId: number, dto: UpdateAppointmentDto) {
    const existAppointment = await this.prismaService.appointment.findFirst({
      where: {
        id: appointmentId,
        deletedAt: null,
      }
    })
    if (!existAppointment) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Appointment #Id${appointmentId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const updated = await this.prismaService.$transaction(async (prisma) => {
        const appointment = await prisma.appointment.update({
          where: {
            id: appointmentId,
          },
          data: {
            scheduledAt: dto.scheduledAt ?? existAppointment.scheduledAt,
            location: dto.location ?? existAppointment.location,
            status: dto.status ?? existAppointment.status,
            notes: dto.notes ?? existAppointment.notes,
          }
        })

        await this.logAudit('UPDATE_APPOINTMENT', appointmentId, { ...dto });

        return appointment;
      })
      return updated;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: Appointment #Id${appointmentId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async deleteAppointment(appointmentId: number) {
    const existAppointment = await this.prismaService.appointment.findFirst({
      where: {
        id: appointmentId,
        deletedAt: null,
      }
    })
    if (!existAppointment) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Appointment #Id${appointmentId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const deleted = await this.prismaService.$transaction(async (prisma) => {
        const appointment = await prisma.appointment.update({
          where: {
            id: appointmentId,
          },
          data: {
            deletedAt: new Date(),
          }
        })

        await this.logAudit('DELETE_APPOINTMENT', appointmentId);

        return appointment;
      })
      return deleted;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: Appointment #Id${appointmentId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async getMyAppointments(query: GetAllAppointmentsDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }

    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
      OR: [
        { buyerId: user.id },
        { agentId: user.id },
      ],
    }

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        ...(where.OR || []),
        {
          post: { postTitle: { contains: q, mode: 'insensitive' } },
        },
      ]
    }

    if (pagingParams.date_from || pagingParams.date_to) {
      where.scheduledAt = {};
      if (pagingParams.date_from) (where.scheduledAt as any).gte = new Date(pagingParams.date_from);
      if (pagingParams.date_to) (where.scheduledAt as any).lte = new Date(pagingParams.date_to);
    }

    if (pagingParams.status) {
      where.status = pagingParams.status;
    }

    const [appointments, total] = await Promise.all([
      this.prismaService.appointment.findMany({
        where,
        orderBy,
        take: pagingParams.pageSize,
        skip: pagingParams.skip,
        select: {
          id: true,
          post: {
            select: {
              id: true,
              postTitle: true,

            }
          },
          buyer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            }
          },
          agent: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            }
          },
          scheduledAt: true,
          location: true,
          status: true,
          notes: true,
        },
      }),
      this.prismaService.appointment.count({ where })
    ]);

    return returnPaging(appointments, total, pagingParams);
  }

  async createMyAppointment(dto: CreateAppointmentDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }
    const roleOfUser = await this.prismaService.role.findFirst({
      where: {
        id: user.roleId,
      }
    });
    if (roleOfUser?.name !== 'AGENT') {
      throw new ApiException(
        `ONLY AGENT CAN CREATE APPOINTMENT FOR BUYER`,
        HttpStatus.FORBIDDEN,
      )
    }

    try {
      const created = await this.prismaService.$transaction(async (prisma) => {
        const appointment = await prisma.appointment.create({
          data: {
            postId: dto.postId,
            buyerId: dto.buyerId,
            agentId: user.id,
            scheduledAt: dto.scheduledAt,
            location: dto.location,
            notes: dto.notes,
            status: AppointmentStatus.SCHEDULED,
          }
        })

        await this.logAudit('CREATE_APPOINTMENT', appointment.id, { ...dto });

        return appointment;
      });
      return created;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: Appointment, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async updateMyAppointment(appointmentId: number, dto: UpdateAppointmentDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }
    const roleOfUser = await this.prismaService.role.findFirst({
      where: {
        id: user.roleId,
      }
    });
    if (roleOfUser?.name !== 'AGENT') {
      throw new ApiException(
        `ONLY AGENT CAN UPDATE APPOINTMENT FOR BUYER`,
        HttpStatus.FORBIDDEN,
      )
    }

    const existAppointment = await this.prismaService.appointment.findFirst({
      where: {
        id: appointmentId,
        deletedAt: null,
        agentId: user.id,
      }
    })
    if (!existAppointment) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Appointment #Id${appointmentId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const updated = await this.prismaService.$transaction(async (prisma) => {
        const appointment = await prisma.appointment.update({
          where: {
            id: appointmentId,
          },
          data: {
            scheduledAt: dto.scheduledAt,
            location: dto.location,
            notes: dto.notes,
            status: AppointmentStatus.SCHEDULED,
          }
        })

        await this.logAudit('UPDATE_APPOINTMENT', appointment.id, { ...dto });

        return appointment;
      });
      return updated;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: Appointment, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  async cancelMyAppointment(appointmentId: number) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        `UNAUTHORIZED USER`,
        HttpStatus.UNAUTHORIZED,
      )
    }

    const existAppointment = await this.prismaService.appointment.findFirst({
      where: {
        id: appointmentId,
        deletedAt: null,
        OR: [
          { buyerId: user.id },
          { agentId: user.id },
        ]
      }
    })
    if (!existAppointment) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Appointment #Id${appointmentId}`,
        HttpStatus.NOT_FOUND,
      )
    }

    try {
      const cancelled = await this.prismaService.$transaction(async (prisma) => {
        const appointment = await prisma.appointment.update({
          where: {
            id: appointmentId,
          },
          data: {
            status: AppointmentStatus.CANCELLED,
          }
        })

        await this.logAudit('CANCEL_APPOINTMENT', appointment.id, {});
        return appointment;
      });
      return cancelled;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: Appointment, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
