import { CoreControllers } from 'libs/utils/decorators/controller-customer.decorator';
import { DepositService } from './deposit.service';
import { Auth } from 'libs/utils';
import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GetAllDepositDto } from './dto/get-all-deposit.dto';
import { UpdateDepositDto } from './dto/update-deposit.dto';
import { AuthorizeDepositDto } from './dto/authorize-deposit.dto';

@CoreControllers({
  path: 'deposit',
  version: '1',
  tag: 'Deposit',
})
export class DepositController {
  constructor(private readonly depositService: DepositService) { }

  // LIST
  @Auth()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllDeposits(@Query() query: GetAllDepositDto) {
    return this.depositService.getAllDeposits(query);
  }

  // DETAIL
  @Auth()
  @Get(':depositId')
  @HttpCode(HttpStatus.OK)
  async getOneDeposit(@Param('depositId', ParseIntPipe) depositId: number) {
    return this.depositService.getOneDeposit(depositId);
  }

  // UPDATE (metadata: holdExpiresAt, note, provider, transactionRef...)
  @Auth()
  @Patch(':depositId')
  @HttpCode(HttpStatus.OK)
  async updateDeposit(
    @Param('depositId', ParseIntPipe) depositId: number,
    @Body() dto: UpdateDepositDto,
  ) {
    return this.depositService.updateDeposit(depositId, dto);
  }

  // ====== BUSINESS TRANSITIONS ======

  // 1) AUTHORIZE — PENDING -> AUTHORIZED (giữ tiền/ủy quyền)
  @Auth()
  @Post('authorize/:depositId')
  @HttpCode(HttpStatus.OK)
  async authorizeDeposit(
    @Param('depositId', ParseIntPipe) depositId: number,
    @Body() dto: AuthorizeDepositDto, // provider? transactionRef? holdTtlHours?
  ) {
    return this.depositService.authorizeDeposit(depositId, dto);
  }

  // 2) CONFIRM — (PENDING|AUTHORIZED) -> CONFIRMED
  @Auth()
  @Post('confirm/:depositId')
  @HttpCode(HttpStatus.OK)
  async confirmDeposit(@Param('depositId', ParseIntPipe) depositId: number) {
    return this.depositService.confirmDeposit(depositId);
  }

  // 3) REFUND — (CONFIRMED) -> REFUNDED
  @Auth()
  @Post('refund/:depositId')
  @HttpCode(HttpStatus.OK)
  async refundDeposit(
    @Param('depositId', ParseIntPipe) depositId: number,
  ) {
    return this.depositService.refundDeposit(depositId);
  }

  // 4) CANCEL — (PENDING|AUTHORIZED) -> CANCELLED
  @Auth()
  @Post('cancel/:depositId')
  @HttpCode(HttpStatus.OK)
  async cancelDeposit(
    @Param('depositId', ParseIntPipe) depositId: number,
  ) {
    return this.depositService.cancelDeposit(depositId);
  }

  // 5) EXPIRE — (PENDING|AUTHORIZED) -> EXPIRED (cron/manual)
  @Auth()
  @Post('expire/:depositId')
  @HttpCode(HttpStatus.OK)
  async expireDeposit(@Param('depositId', ParseIntPipe) depositId: number) {
    return this.depositService.expireDeposit(depositId);
  }

  // 6) FAIL — (PENDING|AUTHORIZED) -> FAILED (gateway/hệ thống lỗi)
  @Auth()
  @Post('fail/:depositId')
  @HttpCode(HttpStatus.OK)
  async failDeposit(
    @Param('depositId', ParseIntPipe) depositId: number,
  ) {
    return this.depositService.failDeposit(depositId);
  }
}
