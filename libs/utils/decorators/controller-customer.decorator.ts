import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Services } from '../enum';

export const CoreControllers =
  (params?: {
    path?: string;
    version?: string;
    tag?: string;
  }): ClassDecorator =>
  (target: any) => {
    let url = `${Services.API_CORE}`;
    if (params?.version) {
      url += `/v${params.version}`;
    }
    if (params?.path) {
      url += `/${params.path}`;
    }

    ApiTags(params?.tag || url)(target);
    Controller(url)(target);
  };
