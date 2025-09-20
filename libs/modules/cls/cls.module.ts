import { Global, Module } from '@nestjs/common';
import { ContextProvider } from 'libs/utils/providers/context.provider';
import { ClsModule as NestClsModule } from 'nestjs-cls';
import { v4 as UUIDv4 } from 'uuid';

@Global()
@Module({
  imports: [
    NestClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup(cls, req) {
          const traceId = UUIDv4();
          req.headers.traceId = traceId;
          cls.set('traceId', traceId);
          ContextProvider.setDateRequest();
        },
      },
    }),
  ],
})
export class ClsModule {}
