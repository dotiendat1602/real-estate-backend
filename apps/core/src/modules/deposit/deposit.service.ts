import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { GetAllDepositDto } from "./dto/get-all-deposit.dto";
import { UpdateDepositDto } from "./dto/update-deposit.dto";
import { assignPaging, returnPaging } from "libs/utils/helpers";
import { DepositStatus, Prisma, User } from "@prisma/client";
import { ApiException } from "libs/utils/exception";
import { ItemMessage } from "libs/utils/enum";
import { ContextProvider } from "libs/utils/providers/context.provider";

const SORT_WHITELIST: Record<string, keyof Prisma.DepositOrderByWithRelationInput> = {
  amount: 'amount',
  status: 'status',
  holdExpiresAt: 'holdExpiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

@Injectable()
export class DepositService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  private readonly FINISHED = new Set<DepositStatus>([
    DepositStatus.REFUNDED,
    DepositStatus.CANCELLED,
    DepositStatus.EXPIRED,
    DepositStatus.FAILED,
  ]);

  private readonly NOT_EXPIRABLE = new Set<DepositStatus>([
    DepositStatus.CONFIRMED,
    DepositStatus.REFUNDED,
  ]);

  private readonly NOT_FAILABLE = new Set<DepositStatus>([
    DepositStatus.CONFIRMED,
    DepositStatus.REFUNDED,
  ]);

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

  private async checkExistDeposit(depositId: number) {
    const existDeposit = await this.prismaService.deposit.findFirst({
      where: {
        id: depositId,
      }
    })
    if (!existDeposit) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Deposit #id${depositId}`,
        HttpStatus.NOT_FOUND,
      )
    }
    return existDeposit;
  }

  private ensureSort(orderKey?: string, sortOrder?: 'asc' | 'desc') {
    const key = orderKey && SORT_WHITELIST[orderKey] ? SORT_WHITELIST[orderKey] : 'createdAt';
    const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';
    return { [key]: order } as Prisma.DepositOrderByWithRelationInput;
  }

  async getAllDeposits(query: GetAllDepositDto) {
    const pagingParams = assignPaging(query);

    const orderBy = this.ensureSort(pagingParams.sortKey, pagingParams.sortOrder);

    const where: Prisma.DepositWhereInput = {};

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        {
          post: { postTitle: { contains: q, mode: 'insensitive' } },
        },
        {
          seller: {
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
        {
          transactionRef: { contains: q, mode: 'insensitive' },
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

    const deposits = await this.prismaService.deposit.findMany({
      where,
      orderBy,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        id: true,
        amount: true,
        status: true,
        transactionRef: true,
        holdExpiresAt: true,
        post: {
          select: {
            property: {
              select: {
                title: true,
              }
            }
          }
        },
        seller: {
          select: {
            name: true,
            phone: true,
          }
        },
        buyer: {
          select: {
            name: true,
            phone: true,
          }
        },
        createdAt: true,
        updatedAt: true,
      }
    })

    const total = await this.prismaService.deposit.count({ where });

    return returnPaging(deposits, total, pagingParams);
  }

  async getOneDeposit(depositId: number) {
    const existDeposit = await this.prismaService.deposit.findFirst({
      where: {
        id: depositId,
      },
      include: {
        post: {
          select: {
            postTitle: true,
            postContent: true,
            property: {
              select: {
                title: true,
                description: true,
                price: true,
                lat: true,
                lon: true,
                location: true,
              }
            }
          }
        },
        buyer: {
          select: {
            name: true,
            phone: true,
            email: true,
          }
        },
        seller: {
          select: {
            name: true,
            phone: true,
            email: true,
          }
        },
      }
    })
    if (!existDeposit) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Deposit #id${depositId}`,
        HttpStatus.NOT_FOUND,
      )
    }
    return existDeposit;
  }

  async updateDeposit(depositId: number, dto: UpdateDepositDto) {
    const existDeposit = await this.checkExistDeposit(depositId);

    // Không cho sửa khi đã kết thúc vòng đời 
    if (this.FINISHED.has(existDeposit.status)) {
      throw new ApiException('Cannot update a finished deposit.', HttpStatus.BAD_REQUEST);
    }

    try {
      const updated = await this.prismaService.$transaction(async (prisma) => {
        const dep = await prisma.deposit.update({
          where: { id: depositId },
          data: {
            holdExpiresAt: dto.holdExpiresAt ?? undefined,
            note: dto.note ?? undefined,
          },
          select: { id: true, holdExpiresAt: true, note: true, provider: true, transactionRef: true, updatedAt: true },
        });
        await this.logAudit('UPDATE_DEPOSIT', depositId, { ...dto });
        return dep;
      });
      return updated;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: Deposit #id${depositId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  // AUTHORIZE — PENDING -> AUTHORIZED (giữ tiền/ủy quyền)
  async authorizeDeposit(
    depositId: number,
    payload?: { provider?: string; transactionRef?: string; holdTtlHours?: number },
  ) {
    const current = await this.checkExistDeposit(depositId);

    if (this.FINISHED.has(current.status)) {
      throw new ApiException('Cannot authorize a finished deposit.', HttpStatus.BAD_REQUEST);
    }
    if (current.status === DepositStatus.AUTHORIZED) {
      return current; // idempotent
    }

    try {
      const updated = await this.prismaService.$transaction(async (tx) => {
        // optional: set/refresh holdExpiresAt
        const holdExpiresAt =
          payload?.holdTtlHours && payload.holdTtlHours > 0
            ? new Date(Date.now() + payload.holdTtlHours * 3600 * 1000)
            : current.holdExpiresAt ?? null;

        const dep = await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: DepositStatus.AUTHORIZED,
            provider: payload?.provider ?? current.provider ?? null,
            transactionRef: payload?.transactionRef ?? current.transactionRef ?? null,
            holdExpiresAt,
          },
          select: {
            id: true, status: true, provider: true, transactionRef: true, holdExpiresAt: true,
          },
        });

        await this.logAudit('AUTHORIZE_DEPOSIT', depositId, {
          oldStatus: current.status,
          newStatus: dep.status,
          provider: dep.provider,
          transactionRef: dep.transactionRef,
          holdExpiresAt: dep.holdExpiresAt,
        });

        return dep;
      });

      return updated;
    } catch (error: any) {
      throw new ApiException(`Fail authorize deposit: #id${depositId}, error ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // CONFIRM — (PENDING|AUTHORIZED) -> CONFIRMED (chốt cọc/thu tiền)
  async confirmDeposit(depositId: number) {
    const current = await this.checkExistDeposit(depositId);

    if (this.FINISHED.has(current.status)) {
      throw new ApiException('Cannot confirm a finished deposit.', HttpStatus.BAD_REQUEST);
    }
    if (current.status === DepositStatus.CONFIRMED && current.confirmedAt) {
      return current;
    }

    try {
      const updated = await this.prismaService.$transaction(async (tx) => {
        // yêu cầu đã AUTHORIZED
        if (current.status !== DepositStatus.AUTHORIZED) { throw new ApiException('Must authorize first.', HttpStatus.BAD_REQUEST); }

        const dep = await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: DepositStatus.CONFIRMED,
            confirmedAt: new Date(),
            paidAt: current.paidAt ?? new Date(),
          },
          select: {
            id: true, status: true, confirmedAt: true, paidAt: true, postId: true,
          },
        });

        await this.logAudit('CONFIRM_DEPOSIT', depositId, {
          oldStatus: current.status,
          newStatus: dep.status,
          confirmedAt: dep.confirmedAt,
          paidAt: dep.paidAt,
        });

        return dep;
      });

      return updated;
    } catch (error: any) {
      throw new ApiException(
        `Fail confirm deposit: #id${depositId}, error ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // REFUND — (CONFIRMED) -> REFUNDED (hoàn tiền)
  async refundDeposit(depositId: number) {
    const current = await this.checkExistDeposit(depositId);

    if (current.status === DepositStatus.REFUNDED) return current; // idempotent
    if (new Set<DepositStatus>([DepositStatus.CANCELLED, DepositStatus.EXPIRED, DepositStatus.FAILED]).has(current.status)) {
      throw new ApiException('Deposit already finished with non-refundable state.', HttpStatus.BAD_REQUEST);
    }

    try {
      const updated = await this.prismaService.$transaction(async (tx) => {
        const dep = await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: DepositStatus.REFUNDED,
            releasedAt: new Date(),
          },
          select: { id: true, status: true, releasedAt: true },
        });

        await this.logAudit('REFUND_DEPOSIT', depositId, {
          oldStatus: current.status,
          newStatus: dep.status,
        });

        return dep;
      });

      return updated;
    } catch (error: any) {
      throw new ApiException(`Fail refund deposit: #id${depositId}, error ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  // CANCEL — (PENDING|AUTHORIZED) -> CANCELLED (hủy bởi user/agent)
  async cancelDeposit(depositId: number) {
    const current = await this.checkExistDeposit(depositId);

    if (this.FINISHED.has(current.status)) {
      return current; // coi như đã kết thúc
    }

    try {
      const updated = await this.prismaService.$transaction(async (tx) => {
        const dep = await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: DepositStatus.CANCELLED,
            releasedAt: new Date(),
          },
          select: { id: true, status: true, releasedAt: true },
        });

        await this.logAudit('CANCEL_DEPOSIT', depositId, {
          oldStatus: current.status,
          newStatus: dep.status,
        });

        return dep;
      });

      return updated;
    } catch (error: any) {
      throw new ApiException(`Fail cancel deposit: #id${depositId}, error ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // EXPIRE — (PENDING|AUTHORIZED) -> EXPIRED (cron quá hạn hold)
  async expireDeposit(depositId: number) {
    const current = await this.checkExistDeposit(depositId);

    if (this.NOT_EXPIRABLE.has(current.status)) {
      throw new ApiException('Cannot expire a confirmed/refunded deposit.', HttpStatus.BAD_REQUEST);
    }
    if (current.status === DepositStatus.EXPIRED) return current; // idempotent

    try {
      const updated = await this.prismaService.$transaction(async (tx) => {
        const dep = await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: DepositStatus.EXPIRED,
            releasedAt: new Date(),
          },
          select: { id: true, status: true, releasedAt: true },
        });

        await this.logAudit('EXPIRE_DEPOSIT', depositId, {
          oldStatus: current.status,
          newStatus: dep.status,
          holdExpiresAt: current.holdExpiresAt,
        });

        return dep;
      });

      return updated;
    } catch (error: any) {
      throw new ApiException(`Fail expire deposit: #id${depositId}, error ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // FAIL — (PENDING|AUTHORIZED) -> FAILED (cổng thanh toán/hệ thống lỗi)
  async failDeposit(depositId: number) {
    const current = await this.checkExistDeposit(depositId);

    if (this.NOT_FAILABLE.has(current.status)) {
      throw new ApiException('Cannot fail a confirmed/refunded deposit.', HttpStatus.BAD_REQUEST);
    }
    if (current.status === DepositStatus.FAILED) return current; // idempotent

    try {
      const updated = await this.prismaService.$transaction(async (tx) => {
        const dep = await tx.deposit.update({
          where: { id: depositId },
          data: {
            status: DepositStatus.FAILED,
            releasedAt: new Date(),
          },
          select: { id: true, status: true, releasedAt: true },
        });

        await this.logAudit('FAIL_DEPOSIT', depositId, {
          oldStatus: current.status,
          newStatus: dep.status,
        });

        return dep;
      });

      return updated;
    } catch (error: any) {
      throw new ApiException(`Fail fail-deposit: #id${depositId}, error ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}