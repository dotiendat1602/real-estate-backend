import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { Prisma, RoleType, User } from '@prisma/client';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { assignPaging, returnPaging } from 'libs/utils/helpers';
import { ApiException } from 'libs/utils/exception';
import { ErrorCode, ItemMessage } from 'libs/utils/enum';
import { GetAllLeadsDto } from '../dto/get-all-leads.dto';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { AssignLeadDto, UpdateLeadDto } from '../dto/update-lead.dto';


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
        agentId: authUser.user_id,
      };
    }

    // fallback: không cho xem (vì endpoint này cần MANAGE_LEADS, nhưng để an toàn)
    return {
      deletedAt: null,
      lead_id: -1,
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
    if (pagingParams.postId) where.post_id = pagingParams.postId;
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
        lead_id: true,
        post_id: true,
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
            post_id: true,
            postTitle: true,
            postStatus: true,
            createdById: true,
          },
        },
        buyer: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        agent: {
          select: {
            user_id: true,
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
        lead_id: leadId,
      },
      select: {
        lead_id: true,
        post_id: true,
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
            post_id: true,
            postTitle: true,
            postStatus: true,
            createdById: true,
            property: {
              select: {
                property_id: true,
                title: true,
                price: true,
                location: true,
              },
            },
          },
        },
        buyer: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        agent: {
          select: {
            user_id: true,
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
      where: { post_id: body.post_id, deletedAt: null },
      select: {
        post_id: true,
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
      where: { user_id: post.createdById, deletedAt: null },
      select: { user_id: true, role: { select: { name: true } } },
    });

    if (createdBy?.role?.name === RoleType.AGENT) {
      autoAgentId = createdBy.user_id;
    }

    try {
      const lead = await this.prismaService.lead.create({
        data: {
          post_id: body.post_id,
          buyerId: body.buyerId ?? null,
          agentId: autoAgentId,
          name: body.name ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          message: body.message ?? null,
          status: 'NEW',
        },
        select: {
          lead_id: true,
          post_id: true,
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
      where: { ...accessWhere, lead_id: leadId },
      select: { lead_id: true },
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
        where: { lead_id: leadId },
        data: {
          status: body.status ?? undefined,
          note: body.note ?? undefined,
        },
        select: {
          lead_id: true,
          post_id: true,
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
      where: { lead_id: leadId, deletedAt: null },
      select: { lead_id: true },
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
      where: { user_id: body.agentId, deletedAt: null },
      select: { user_id: true, role: { select: { name: true } } },
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
        where: { lead_id: leadId },
        data: { agentId: body.agentId },
        select: {
          lead_id: true,
          post_id: true,
          buyerId: true,
          agentId: true,
          status: true,
          updatedAt: true,
          agent: { select: { user_id: true, name: true, email: true } },
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
      where: { lead_id: leadId, deletedAt: null },
      select: { lead_id: true },
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
        where: { lead_id: leadId },
        data: { deletedAt: new Date() },
        select: {
          lead_id: true,
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
}
