import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { LeadStatus, Prisma, RoleType, User } from '@prisma/client';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { ApiException } from 'libs/utils/exception';
import { ErrorCode, ItemMessage } from 'libs/utils/enum';
import { GetAllLeadsDto } from '../dto/get-all-leads.dto';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { AssignLeadDto, UpdateLeadDto } from '../dto/update-lead.dto';
import { GetMyLeadsDto } from '../dto/get-my-leads.dto';


@Injectable()
export class LeadService {
  constructor(private readonly prismaService: PrismaService) { }

  private buildLeadAccessWhere(authUser: User): Prisma.LeadWhereInput {
    // Admin/Manager: thấy tất cả
    // Agent: chỉ thấy lead được assign cho mình (agentId = mình)
    // (Nếu bạn muốn agent thấy lead theo post do mình tạo: mở rộng thêm OR)
    const roleName = (authUser as any)?.role?.name as RoleType | undefined;

    if (roleName === RoleType.ADMIN || roleName === RoleType.MANAGER) {
      return { deletedAt: null };
    }

    if (roleName === RoleType.AGENT) {
      return {
        deletedAt: null,
        agentId: authUser.id,
      };
    }

    // fallback: không cho xem (vì endpoint này cần MANAGE_LEADS, nhưng để an toàn)
    return {
      deletedAt: null,
      id: -1,
    };
  }

  async getLeads(query: GetAllLeadsDto) {
    const pagingParams = assignPaging(query);

    const authUser = ContextProvider.getAuthUser<User>();
    const accessWhere = this.buildLeadAccessWhere(authUser);

    const where: Prisma.LeadWhereInput = {
      ...accessWhere,
    };

    if (pagingParams.search) {
      const q = pagingParams.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
        {
          post: {
            postTitle: { contains: q, mode: 'insensitive' },
          },
        },
      ];
    }

    if (pagingParams.status) where.status = pagingParams.status;
    if (pagingParams.postId) where.postId = pagingParams.postId;
    if (pagingParams.buyerId) where.buyerId = pagingParams.buyerId;
    if (pagingParams.agentId) {
      // Admin/Manager mới nên filter agentId tùy ý
      // Agent tự filter bằng accessWhere rồi
      where.agentId = pagingParams.agentId;
    }

    const allowedSortKeys = new Set(['createdAt', 'updatedAt', 'status']);
    const sortKey = allowedSortKeys.has(pagingParams.sortKey)
      ? pagingParams.sortKey
      : 'createdAt';

    const orderObject: Prisma.LeadOrderByWithRelationInput = {
      [sortKey]: pagingParams.sortOrder || 'desc',
    };

    const leads = await this.prismaService.lead.findMany({
      where,
      orderBy: orderObject,
      skip: pagingParams.skip,
      take: pagingParams.pageSize,
      select: {
        id: true,
        postId: true,
        buyerId: true,
        agentId: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        note: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        post: {
          select: {
            id: true,
            postTitle: true,
            postStatus: true,
            createdById: true,
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const totalItems = await this.prismaService.lead.count({ where });

    return returnPaging(leads, totalItems, pagingParams);
  }

  async getLeadDetail(leadId: number) {
    const authUser = ContextProvider.getAuthUser<User>();
    const accessWhere = this.buildLeadAccessWhere(authUser);

    const lead = await this.prismaService.lead.findFirst({
      where: {
        ...accessWhere,
        id: leadId,
      },
      select: {
        id: true,
        postId: true,
        buyerId: true,
        agentId: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        note: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        post: {
          select: {
            id: true,
            postTitle: true,
            postStatus: true,
            createdById: true,
            property: {
              select: {
                id: true,
                title: true,
                price: true,
                location: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!lead) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Lead not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    return lead;
  }

  async createLead(body: CreateLeadDto) {
    // Optional: nếu endpoint public thì buyerId có thể null
    // Validate post tồn tại + không bị deleted
    const post = await this.prismaService.post.findFirst({
      where: { id: body.postId, deletedAt: null },
      select: {
        id: true,
        createdById: true,
        postStatus: true,
      },
    });

    if (!post) {
      throw new ApiException(
        `Post not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    // Auto assign agent: gán cho người tạo bài (createdById) nếu user đó là AGENT
    // Nếu không phải agent thì để null (Admin/Manager sẽ assign sau)
    let autoAgentId: number | null = null;
    const createdBy = await this.prismaService.user.findFirst({
      where: { id: post.createdById, deletedAt: null },
      select: { id: true, role: { select: { name: true } } },
    });

    if (createdBy?.role?.name === RoleType.AGENT) {
      autoAgentId = createdBy.id;
    }

    try {
      const lead = await this.prismaService.lead.create({
        data: {
          postId: body.postId,
          buyerId: body.buyerId ?? null,
          agentId: autoAgentId,
          name: body.name ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          message: body.message ?? null,
          status: LeadStatus.NEW,
        },
        select: {
          id: true,
          postId: true,
          buyerId: true,
          agentId: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          note: true,
          status: true,
          createdAt: true,
        },
      });

      return lead;
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_CREATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      );
    }
  }

  async updateLead(leadId: number, body: UpdateLeadDto) {
    const authUser = ContextProvider.getAuthUser<User>();
    const accessWhere = this.buildLeadAccessWhere(authUser);

    const exist = await this.prismaService.lead.findFirst({
      where: { ...accessWhere, id: leadId },
      select: { id: true },
    });

    if (!exist) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Lead not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    try {
      return await this.prismaService.lead.update({
        where: { id: leadId },
        data: {
          status: body.status ?? undefined,
          note: body.note ?? undefined,
        },
        select: {
          id: true,
          postId: true,
          buyerId: true,
          agentId: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          note: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      );
    }
  }

  async updateStatus(leadId: number, status: LeadStatus) {
    const authUser = ContextProvider.getAuthUser<User>();
    const accessWhere = this.buildLeadAccessWhere(authUser);

    const exist = await this.prismaService.lead.findFirst({
      where: { ...accessWhere, id: leadId },
      select: { id: true },
    });

    if (!exist) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Lead not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    try {
      const updated = await this.prismaService.$transaction(async (prisma) => {
        const updatedLead = await prisma.lead.update({
          where: { id: leadId },
          data: { status },
        });

        // TODO: Add log action later
        return updatedLead;
      });
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      );
    }
  }

  async assignLead(leadId: number, body: AssignLeadDto) {
    // chỉ ADMIN/MANAGER nên assign; nhưng hiện @Auth MANAGE_LEADS đã cho agent vào
    // => enforce thêm bằng role check
    const authUser = ContextProvider.getAuthUser<User>();
    const roleName = (authUser as any)?.role?.name as RoleType | undefined;

    if (roleName !== RoleType.ADMIN && roleName !== RoleType.MANAGER) {
      throw new ApiException(
        `You do not have permission to assign leads`,
        HttpStatus.FORBIDDEN,
        ErrorCode.INVALID_INPUT,
      );
    }

    const lead = await this.prismaService.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true },
    });

    if (!lead) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Lead not found`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    // validate agent exists + role=AGENT
    const agent = await this.prismaService.user.findFirst({
      where: { id: body.agentId, deletedAt: null },
      select: { id: true, role: { select: { name: true } } },
    });

    if (!agent || agent.role?.name !== RoleType.AGENT) {
      throw new ApiException(
        `Agent not found or user is not AGENT`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    try {
      return await this.prismaService.lead.update({
        where: { id: leadId },
        data: { agentId: body.agentId },
        select: {
          id: true,
          postId: true,
          buyerId: true,
          agentId: true,
          status: true,
          updatedAt: true,
          agent: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_UPDATE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      );
    }
  }

  async deleteLead(leadId: number) {
    const authUser = ContextProvider.getAuthUser<User>();
    const roleName = (authUser as any)?.role?.name as RoleType | undefined;

    // thường chỉ Admin/Manager được xoá lead
    if (roleName !== RoleType.ADMIN && roleName !== RoleType.MANAGER) {
      throw new ApiException(
        `You do not have permission to delete leads`,
        HttpStatus.FORBIDDEN,
        ErrorCode.INVALID_INPUT,
      );
    }

    const exist = await this.prismaService.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true },
    });

    if (!exist) {
      throw new ApiException(
        `${ItemMessage.NOT_FOUND}: Lead not found or has been deleted`,
        HttpStatus.NOT_FOUND,
        ErrorCode.INVALID_INPUT,
      );
    }

    try {
      return await this.prismaService.lead.update({
        where: { id: leadId },
        data: { deletedAt: new Date() },
        select: {
          id: true,
          deletedAt: true,
        },
      });
    } catch (error) {
      throw new ApiException(
        `${ItemMessage.FAIL_DELETE}: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INVALID_INPUT,
      );
    }
  }

  async getMyLeads(query: GetMyLeadsDto) {
    const user = ContextProvider.getAuthUser<User>();
    if (!user) {
      throw new ApiException(
        `Unauthorized`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const paging = assignPaging(query);

    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      buyerId: user.id,
    };

    const [leads, total] = await Promise.all([
      this.prismaService.lead.findMany({
        where,
        skip: paging.skip,
        take: paging.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              postTitle: true,
              postStatus: true,
              property: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  location: true,
                },
              },
            }
          },
          agent: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          }
        }
      }),
      this.prismaService.lead.count({ where }),
    ]);

    return returnPaging(leads, total, paging);
  }
}
