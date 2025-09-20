import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class HttpInterceptor implements NestInterceptor {
  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const context = executionContext.switchToHttp();
    const request = context.getRequest<Request>();
    const headers = executionContext.getArgs()[0]?.headers;
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: DateTime.fromJSDate(new Date())
          .setZone(process.env.TZ)
          .toFormat('dd/MM/yyyy HH:mm:ss'),
        path: request.url,
        traceId: headers.traceId,
      })),
    );
  }
}
