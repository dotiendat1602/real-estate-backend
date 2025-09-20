import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiException } from '../exception';

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        error.status = [error.status, error?.response?.status, 500].find(
          Boolean,
        );

        const isClassValidatorError = [
          error.status === HttpStatus.PRECONDITION_FAILED,
          Array.isArray(error?.response?.message),
        ].every(Boolean);

        if (isClassValidatorError) {
          error.message = error?.response?.message.join(', ');
          error.response.message = error.message;
        }

        const headers = executionContext.getArgs()[0]?.headers;

        error.user = headers.user;

        this.sanitizeExternalError(error);

        if (typeof error === 'object' && !error.traceId) {
          error.traceId = headers.traceId;
        }

        const context = `${executionContext.getClass().name}/${executionContext.getHandler().name}`;

        error.context = error.context = context;
        throw new ApiException(error, error.status);
      }),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitizeExternalError(error: any) {
    if (typeof error?.response === 'object' && error?.isAxiosError) {
      error['getResponse'] = () => ({ ...error?.response?.data?.error });
      error['getStatus'] = () =>
        [error?.response?.data?.error?.code, error?.status].find(Boolean);
      error.message = [
        error?.response?.data?.error?.message,
        error.message,
      ].find(Boolean);
      error.traceId = error?.response?.data?.error?.traceId;
    }
  }
}
