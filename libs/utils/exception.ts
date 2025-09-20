import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './enum';

export type ErrorModel = {
  error: {
    statusCode: string | number;
    errorCode: ErrorCode;
    traceId: string;
    message: string;
    timestamp: string;
    path: string;
    data?: unknown;
  };
};

export class ApiException extends HttpException {
  context: string;
  traceId: string;
  statusCode: number;
  errorCode?: ErrorCode;
  config?: unknown;
  user?: string;
  data?: unknown;
  ctx: string;

  constructor(
    error: string | object,
    status?: HttpStatus,
    errorCode: ErrorCode = ErrorCode.INVALID_INPUT,
    ctx?: string,
  ) {
    super(error, status || HttpStatus.INTERNAL_SERVER_ERROR);
    this.statusCode = super.getStatus();
    this.errorCode = errorCode;

    if (ctx) {
      this.context = ctx;
    }
  }

  setData(data: unknown) {
    this.data = data;
  }
}
