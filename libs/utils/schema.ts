import { HttpStatus } from '@nestjs/common';
import { ApiResponseOptions } from '@nestjs/swagger';

export const responseSuccessBasic: ApiResponseOptions = {
  status: HttpStatus.OK,
  description: 'Response example',
  schema: {
    example: {
      data: true,
    },
  },
};
