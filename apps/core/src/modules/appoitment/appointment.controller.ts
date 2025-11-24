import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { AppointmentService } from "./appointment.service";
import { Auth } from "libs/utils";
import { Body, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";

@CoreControllers({
  path: 'appointment',
  version: '1',
  tag: 'Appointment'
})
export class AppointmentController {
  constructor(
    private readonly appoitmentService: AppointmentService,
  ) { }

  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPostsNotConfirm(
    @Query() query: any,
  ) {
    return await this.appoitmentService.getAllAppointments(query);
  }

  @Auth()
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
