import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { StatusLogAction } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from 'libs/modules/prisma/prisma.service';
import { hideImportantInformation } from '../util';
import { ValuesImportant } from '../enum';

@Injectable()
export class LogActionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LogActionMiddleware.name);

  constructor(private readonly prismaService: PrismaService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, ip, body, query, baseUrl } = req;
    const urlsHandle: string[] = [];

    if (!urlsHandle.includes(baseUrl)) {
      return next();
    }
    const now = Date.now();

    const originalSend = res.send.bind(res);
    const bodyData = hideImportantInformation(body, ValuesImportant);

    res.send = (data: any) => {
      const log = {
        url: baseUrl,
        method,
        body: JSON.stringify(bodyData),
        query: JSON.stringify(query),
        ip,
        timeCall: Date.now() - now,
        status:
          res.statusCode === 200
            ? StatusLogAction.ACTIVE
            : StatusLogAction.INACTIVE,
        data: JSON.stringify(data),
      } as any;

      this.prismaService.logAction
        .create({ data: log })
        .catch((err) => this.logger.error('Failed to log action:', err));

      return originalSend(data);
    };

    next();
  }
}
