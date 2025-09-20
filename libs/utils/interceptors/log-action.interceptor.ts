import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { hideImportantInformation } from '../util';
import { Request } from 'express';
import { StatusLog } from '../enum';
import { PrismaService } from 'libs/modules/prisma/prisma.service';

export interface Response<T> {
  data: T;
}
export const ValuesImportant = [
  'password',
  'refreshToken',
  'oldPassword',
  'newPassword',
];

@Injectable()
export class LogActionInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  private readonly logger: Logger = new Logger(LogActionInterceptor.name);

  constructor(private readonly prismaService: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<Response<T>>> {
    const request = context?.switchToHttp()?.getRequest() as Request;

    const now = Date.now();
    const { body, url, method, ip, query, ...other } = request;
    const user = request.user as any;
    const data = hideImportantInformation(request.body, ValuesImportant);
    const dataLogAction: any = {
      url,
      method,
      body: JSON.stringify(data),
      ip,
      query: JSON.stringify(query),
      now: new Date().toISOString(),
      userId: user.id || null,
    };

    return next.handle().pipe(
      tap((response) => {
        Object.assign(dataLogAction, {
          data: JSON.stringify({ ...response }),
          timeCall: Date.now() - now,
          status: StatusLog.ACTIVE,
        });
        this.prismaService.logAction
          .create({ data: dataLogAction })
          .then((result) => this.logger.log(JSON.stringify(result)));
      }),

      catchError((err) => {
        Object.assign(dataLogAction, {
          data: JSON.stringify({ ...err }),
          timeCall: Date.now() - now,
          status: StatusLog.INACTIVE,
        });

        this.prismaService.logAction
          .create({
            data: dataLogAction,
          })
          .then((result) => this.logger.log(JSON.stringify(result)));

        return throwError(() => err);
      }),
    );
  }
}
