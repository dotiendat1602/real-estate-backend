import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Delete,
  Query,
} from '@nestjs/common';
import { CoreControllers } from 'libs/utils/decorators/controller-customer.decorator';
import { Auth } from 'libs/utils';
import { SystemPermissionType } from '@prisma/client';
import { CreateLeadDto } from './dto/create-lead.dto';
import { AssignLeadDto, UpdateLeadDto } from './dto/update-lead.dto';
import { LeadService } from './services/lead.service';
import { GetAllLeadsDto } from './dto/get-all-leads.dto';

@CoreControllers({
  path: 'leads',
  version: '1',
  tag: 'Lead',
})
export class LeadController {
  constructor(private readonly leadService: LeadService) { }

  // PUBLIC / AUTH: create lead from post detail page
  @Post()
  @HttpCode(HttpStatus.OK)
  async createLead(@Body() body: CreateLeadDto) {
    return await this.leadService.createLead(body);
  }

  @Auth([SystemPermissionType.MANAGE_LEADS])
  @Get()
  @HttpCode(HttpStatus.OK)
  async getLeads(@Query() query: GetAllLeadsDto) {
    return await this.leadService.getLeads(query);
  }

  @Auth([SystemPermissionType.MANAGE_LEADS])
  @Get(':leadId')
  @HttpCode(HttpStatus.OK)
  async getLeadDetail(@Param('leadId', ParseIntPipe) leadId: number) {
    return await this.leadService.getLeadDetail(leadId);
  }

  @Auth([SystemPermissionType.MANAGE_LEADS])
  @Patch(':leadId')
  @HttpCode(HttpStatus.OK)
  async updateLead(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: UpdateLeadDto,
  ) {
    return await this.leadService.updateLead(leadId, body);
  }

  @Auth([SystemPermissionType.MANAGE_LEADS])
  @Patch(':leadId/assign')
  @HttpCode(HttpStatus.OK)
  async assignLead(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() body: AssignLeadDto,
  ) {
    return await this.leadService.assignLead(leadId, body);
  }

  @Auth([SystemPermissionType.MANAGE_LEADS])
  @Delete(':leadId')
  @HttpCode(HttpStatus.OK)
  async deleteLead(@Param('leadId', ParseIntPipe) leadId: number) {
    return await this.leadService.deleteLead(leadId);
  }
}
