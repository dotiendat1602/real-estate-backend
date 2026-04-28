import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { AppointmentService } from "./appointment.service";
import { Auth } from "libs/utils";
import { Body, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { SystemPermissionType } from "@prisma/client";
import { GetAllAppointmentsDto } from "./dto/get-all-appointment.dto";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";

@CoreControllers({
  path: 'appointment',
  version: '1',
  tag: 'Appointment'
})
export class AppointmentController {
  constructor(
    private readonly appoitmentService: AppointmentService,
  ) { }

  @Auth([SystemPermissionType.MANAGE_APPOINTMENT])
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllAppointments(
    @Query() query: GetAllAppointmentsDto,
  ) {
    return await this.appoitmentService.getAllAppointments(query);
  }

  // For user, agent
  // Endpoint: GET /api/core/v1/appointment/me
  @Auth()
  @Get("me")
  @HttpCode(HttpStatus.OK)
  async getMyAppointments(
    @Query() query: GetAllAppointmentsDto,
  ) {
    return await this.appoitmentService.getMyAppointments(query);
  }

  // For agent to create appointment for user
  // Endpoint: POST /api/core/v1/appointment/me
  @Auth()
  @Post("me")
  @HttpCode(HttpStatus.OK)
  async createMyAppointment(
    @Body() dto: CreateAppointmentDto,
  ) {
    return await this.appoitmentService.createMyAppointment(dto);
  }

  // For agent to update appointment for user
  // Endpoint: Patch /api/core/v1/appointment/me/:appointmentId
  @Auth()
  @Patch("me/:appointmentId")
  @HttpCode(HttpStatus.OK)
  async updateMyAppointment(
    @Param("appointmentId", ParseIntPipe) appointmentId: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return await this.appoitmentService.updateMyAppointment(appointmentId, dto);
  }

  // For user to cancel his appointment
  // Endpoint: Patch /api/core/v1/appointment/cancel/:appointmentId
  @Auth()
  @Patch("cancel/:appointmentId")
  @HttpCode(HttpStatus.OK)
  async cancelMyAppointment(
    @Param("appointmentId", ParseIntPipe) appointmentId: number,
  ) {
    return await this.appoitmentService.cancelMyAppointment(appointmentId);
  }

  @Auth([SystemPermissionType.MANAGE_APPOINTMENT])
  @Get(":appointmentId")
  @HttpCode(HttpStatus.OK)
  async getOneAppointment(
    @Param("appointmentId", ParseIntPipe) appointmentId: number,
  ) {
    return await this.appoitmentService.getOneAppointment(appointmentId);
  }

  @Auth()
  @Patch(":appointmentId")
  @HttpCode(HttpStatus.OK)
  async updateAppointment(
    @Param("appointmentId", ParseIntPipe) appointmentId: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return await this.appoitmentService.updateAppointment(appointmentId, dto);
  }
}
