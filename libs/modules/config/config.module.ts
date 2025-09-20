import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from './config.service';
import {
  ConfigModuleOptions,
  ConfigModule as NestConfigModule,
} from '@nestjs/config';

interface Options extends ConfigModuleOptions {
  provider?: Provider[];
  exports?: Provider[];
}

@Global()
@Module({})
export class ConfigModule {
  static register(options?: Options) {
    return {
      module: ConfigModule,
      providers: [ConfigService, ...(options?.provider ?? [])],
      exports: [ConfigService, ...(options?.exports ?? [])],
      imports: [NestConfigModule.forRoot(options)],
    };
  }
}
