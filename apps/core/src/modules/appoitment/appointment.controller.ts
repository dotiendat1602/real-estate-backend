import { CoreControllers } from "libs/utils/decorators/controller-customer.decorator";
import { AppointmentService } from "./appointment.service";
import { Auth } from "libs/utils";
import { Get, HttpCode, HttpStatus, Query } from "@nestjs/common";

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
}