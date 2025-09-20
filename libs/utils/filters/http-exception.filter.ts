import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { Request } from 'express';
import { ApiException, ErrorModel } from '../exception';
import { LoggerService } from 'libs/modules/logger/logger.service';

const errorStatus: Record<string, string> = {
  ECONNREFUSED: 'Connection Refused',
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '406': 'Not Acceptable',
  '408': 'Request Timeout',
  '413': 'Payload Too Large',
  '414': 'URI Too Long',
  '422': 'Unprocessable Entity',
  '428': 'Precondition Required',
  '429': 'Too Many Requests',
  '500': 'Internal Server Error.',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Gateway Timeout',
  '507': 'Insufficient Storage',
  '508': 'Loop Detected',
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  catch(exception: ApiException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<Request>();

    this.loggerService.error(exception, exception.message, exception.context);

    const status = (
      exception instanceof HttpException
        ? exception.getStatus()
        : [exception['status'], HttpStatus.INTERNAL_SERVER_ERROR].find(Boolean)
    ) as number;
    const errorCode = exception['errorCode'];

    response.status(status).json({
      error: {
        code: status,
        traceId: request.headers.traceId,
        message: [exception.message, errorStatus[status.toString()]].find(
          Boolean,
        ),
        timestamp: DateTime.fromJSDate(new Date())
          .setZone(process.env.TZ)
          .toFormat('dd/MM/yyyy HH:mm:ss'),
        path: request.url,
        errorCode,
      },
    } as unknown as ErrorModel);
  }
}
