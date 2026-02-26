import {
  HttpStatus,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { bold } from 'colorette';
import compression from 'compression';
import helmet from 'helmet';
import { ConfigService } from 'libs/modules/config/config.service';
import { LoggerService } from 'libs/modules/logger/logger.service';
import { AppExceptionFilter } from './filters';
import {
  ExceptionInterceptor,
  HttpInterceptor,
  HttpLoggerInterceptor,
} from './interceptors';
import './polyfill';
import { setupSwagger } from './setup-swagger';

export const setupApp = async (
  appName: string,
  app: NestExpressApplication,
) => {
  app.enableCors({ origin: '*' });
  app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
  app.use(helmet());
  app.use(compression());

  const loggerService = app.get(LoggerService);
  const secretService = app.get(ConfigService);

  loggerService.setApplication(appName);
  app.useLogger(loggerService);

  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: HttpStatus.PRECONDITION_FAILED,
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AppExceptionFilter(loggerService));

  app.useGlobalInterceptors(
    new ExceptionInterceptor(),
    new HttpLoggerInterceptor(loggerService),
    new HttpInterceptor(),
  );

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: '/metrics', method: RequestMethod.GET },
    ],
  });

  if (secretService.application.ENABLE_DOCS) {
    setupSwagger(app);
    loggerService.log(
      `Documentation: http://localhost:${secretService.application.PORT}/docs`,
    );
  }

  await app.listen(secretService.application.PORT);
  loggerService.log(
    `🟢 ${appName} listening at ${bold(secretService.application.PORT)} on ${bold(
      secretService.application.NODE_ENV,
    )} 🟢\n`,
  );
};

//                       _oo0oo_
//                      o8888888o
//                      88" . "88
//                      (| -_- |)
//                      0\  =  /0
//                    ___/`---'\___
//                  .' \\|     |// '.
//                 / \\|||  :  |||// \
//                / _||||| -:- |||||- \
//               |   | \\\  -  /// |   |
//               | \_|  ''\---/''  |_/ |
//               \  .-\__  '-'  ___/-. /
//             ___'. .'  /--.--\  `. .'___
//          ."" '<  `.___\_<|>_/___.' >' "".
//         | | :  `- \`.;`\ _ /`;.`/ - ` : | |
//         \  \ `_.   \_ __\ /__ _/   .-` /  /
//     =====`-.____`.___ \_____/___.-`___.-'=====
//                       `=---='
//
//     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//            Phật phù hộ, không bao giờ BUG
//     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
