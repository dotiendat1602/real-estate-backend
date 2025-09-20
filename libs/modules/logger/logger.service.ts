import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Scope,
} from '@nestjs/common';
import axios from 'axios';
import { gray, green, isColorSupported, red, yellow } from 'colorette';
import { IncomingMessage, ServerResponse } from 'http';
import { ErrorCode } from 'libs/utils/enum';
import { ApiException } from 'libs/utils/exception';
import { DateTime } from 'luxon';
import { LevelWithSilent, Logger, multistream, pino } from 'pino';
import { HttpLogger, Options, pinoHttp } from 'pino-http';
import pinoPretty from 'pino-pretty';
import { ErrorType, MessageType } from './logger.type';
import { PinoRequestConverterCustomer } from './request-convert';

@Injectable({ scope: Scope.REQUEST })
export class LoggerService {
  pino: HttpLogger;
  private app: string;

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  connect<T = LevelWithSilent>(logLevel: T): void {
    // const ogitStream = {
    //   level: logLevel?.toString() || 'info',
    //   stream: {
    //     write: (log: string) => {
    //       console.log(log);
    //       axios
    //         .post('https://api-eu.logit.io/v2', log, {
    //           headers: {
    //             'Content-Type': 'application/json',
    //             ApiKey: 'cb318f72-0b6f-4e9a-b3e6-9edf1861f61a',
    //           },
    //         })
    //         .catch((err) => {
    //           console.error(
    //             'Failed to send log to Ogit.io:',
    //             err.response?.status || err.message,
    //           );
    //         });
    //     },
    //   },
    // };

    const pinoLogger = pino(
      {
        level: logLevel?.toString() || 'trace',
        timestamp: pino.stdTimeFunctions.isoTime,
        base: null,
        formatters: {
          level: (label) => {
            return { level: label.toUpperCase() };
          },
        },
      },
      multistream(
        this.isProduction
          ? [
              // ogitStream,
              {
                level: 'trace',
                stream: process.stdout,
              },
            ]
          : [
              {
                level: 'trace',
                stream: pinoPretty(this.getPinoConfig()),
              },
            ],
      ),
    );

    this.pino = pinoHttp(this.getPinoHttpConfig(pinoLogger));
  }

  setApplication(app: string): void {
    this.app = app;
  }

  log(message: string): void {
    this.isProduction
      ? this.pino.logger.trace(message)
      : this.pino.logger.trace(green(message));
  }

  trace({ message, context, obj = {} }: MessageType): void {
    Object.assign(obj, { context });
    this.isProduction
      ? this.pino.logger.trace([obj, message].find(Boolean), message)
      : this.pino.logger.trace(
          [obj, gray(message)].find(Boolean),
          gray(message),
        );
  }

  info({ message, context, obj = {} }: MessageType): void {
    Object.assign(obj, { context });
    this.isProduction
      ? this.pino.logger.info([obj, message].find(Boolean), message)
      : this.pino.logger.info(
          [obj, green(message)].find(Boolean),
          green(message),
        );
  }

  warn({ message, context, obj = {} }: MessageType): void {
    Object.assign(obj, { context });
    this.isProduction
      ? this.pino.logger.warn([obj, message].find(Boolean), message)
      : this.pino.logger.warn(
          [obj, yellow(message)].find(Boolean),
          yellow(message),
        );
  }

  error(error: ErrorType, message?: string, context?: string): void {
    const errorResponse = this.getErrorResponse(error);

    const response =
      error instanceof ApiException
        ? { statusCode: error.getStatus(), message: error?.message }
        : errorResponse?.value();

    const type = {
      Error: ApiException.name,
    }[error?.name];

    message = message || error.message;

    this.pino.logger.error(
      {
        response,
        context: [context, this.app].find(Boolean),
        type: [type, error?.name].find(Boolean),
        traceId: this.getTraceId(error),
        timestamp: this.getDateFormat(),
        application: this.app,
        stack: error.stack,
      },
      this.isProduction ? message : red(message),
    );
  }

  fatal(error: ErrorType, message?: string, context?: string): void {
    message = message || error.message;
    this.pino.logger.fatal(
      {
        ...(error.getResponse() as object),
        context: [context, this.app].find(Boolean),
        type: error.name,
        traceId: this.getTraceId(error),
        timestamp: this.getDateFormat(),
        application: this.app,
        stack: error.stack,
      },
      this.isProduction ? message : red(message),
    );
  }

  private getPinoConfig() {
    return {
      colorize: isColorSupported,
      levelFirst: true,
      ignore: 'pid,hostname',
      quietReqLogger: true,
      messageFormat: (log: any, messageKey: string) => {
        const message = log[String(messageKey)];
        if (this.app) {
          return `[${this.app}] ${message}`;
        }

        return message;
      },
      customPrettifiers: {
        time: () => {
          return `[${this.getDateFormat()}]`;
        },
      },
    };
  }

  private getPinoHttpConfig(pinoLogger: Logger): Options {
    return {
      logger: pinoLogger,
      quietReqLogger: true,
      customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
        return `request ${
          res.statusCode >= 400
            ? this.isProduction
              ? 'error'
              : red('error')
            : this.isProduction
              ? 'success'
              : green('success')
        } with status code: ${res.statusCode}`;
      },
      customErrorMessage: (
        req: IncomingMessage,
        res: ServerResponse,
        error: Error,
      ) => {
        return `request ${
          this.isProduction ? error.name : red(error.name)
        } with status code: ${res.statusCode} `;
      },
      serializers: {
        err: () => false,
        req: (request) => {
          return {
            method: request.method,
            curl: PinoRequestConverterCustomer.getCurl(request),
          };
        },
        // req: () => false,
        res: () => false,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customProps: (req: any): any => {
        const context = req.context;

        const traceId = [req?.headers?.traceId, req.id].find(Boolean);

        const path = `${req.protocol}://${req.headers.host}${req.url}`;

        this.pino.logger.setBindings({
          traceId,
          application: this.app,
          context: context,
          path,
          timestamp: this.getDateFormat(),
        });

        return {
          traceId,
          application: this.app,
          context: context,
          path,
          timestamp: this.getDateFormat(),
        };
      },
      customLogLevel: (
        req: IncomingMessage,
        res: ServerResponse,
        error: Error,
      ) => {
        if ([res.statusCode >= 400, error].some(Boolean)) {
          return 'error';
        }

        if ([res.statusCode >= 300, res.statusCode <= 400].every(Boolean)) {
          return 'silent';
        }

        return 'info';
      },
      wrapSerializers: true,
    };
  }

  private getErrorResponse(error: ErrorType): any {
    const isFunction = typeof error?.getResponse === 'function';
    return [
      {
        conditional: typeof error === 'string',
        value: () => new InternalServerErrorException(error).getResponse(),
      },
      {
        conditional: error instanceof ApiException,
        value: () => {
          if (error instanceof ApiException) {
            return new ApiException(
              error.getResponse(),
              [error.getStatus(), error['status']].find(Boolean),
              [error.errorCode, ErrorCode.INVALID_INPUT].find(Boolean),
              error.ctx,
            ).getResponse();
          }
        },
      },
      {
        conditional: error instanceof HttpException,
        value: () => {
          if (error instanceof HttpException) {
            return new ApiException(
              error.getResponse(),
              [error.getStatus(), error['status']].find(Boolean),
            ).getResponse();
          }
        },
      },
      {
        conditional: isFunction && typeof error.getResponse() === 'object',
        value: () => error?.getResponse(),
      },
      {
        conditional: [
          error?.name === Error.name,
          error?.name == TypeError.name,
        ].some(Boolean),
        value: () =>
          new InternalServerErrorException(error.message).getResponse(),
      },
    ].find((c) => c.conditional);
  }

  private getDateFormat(
    date = new Date(),
    format = 'dd/MM/yyyy HH:mm:ss',
  ): string {
    return DateTime.fromJSDate(date).setZone(process.env.TZ).toFormat(format);
  }

  private getTraceId(error: any): string {
    return error.traceId;
  }
}
