import { HttpStatus } from '@nestjs/common';
import { ApiResponseOptions } from '@nestjs/swagger';

export const responseRegisterSuccess: ApiResponseOptions = {
  status: HttpStatus.OK,
  description: 'Response register success example',
  schema: {
    example: {
      data: {
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInR5cGUiOiJBQ0NFU1NfVE9LRU4iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTczNzE4MTI3NSwiZXhwIjoxNzM3MjY3Njc1fQ.J4gdZdyOMSLjMqUg9PbXN-tF2obRmxK8shCw3M9j1Y0',
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInR5cGUiOiJSRUZSRVNIX1RPS0VOIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MzcxODEyNzUsImV4cCI6MTczNzI2NzY3NX0.iRGXnVEgm7NVrjKxdY0CAVXvGsrno5rcPWy70hZfgCw',
      },
      timestamp: '18/01/2025 13:21:15',
      path: '/api/core/v1/auth/register',
      traceId: '598eb5a9-df40-4e96-a810-51de4a3a583d',
    },
  },
};

export const responseRegisterFail: ApiResponseOptions = {
  status: HttpStatus.BAD_REQUEST,
  description: 'Response register fail example',
  schema: {
    example: {
      error: {
        code: 400,
        traceId: '9a026721-5efb-48c8-bb22-97be6bf1340a',
        message: 'User existing',
        timestamp: '18/01/2025 13:26:41',
        path: '/api/core/v1/auth/register',
        errorCode: 'ERR100',
      },
    },
  },
};

export const responseLoginSuccess: ApiResponseOptions = {
  status: HttpStatus.OK,
  description: 'Response login success example',
  schema: {
    example: {
      data: {
        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInR5cGUiOiJBQ0NFU1NfVE9LRU4iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTczNzE4MjYxOSwiZXhwIjoxNzM3MjY5MDE5fQ.b4N1K4SyeVASup5m2_AK9Pi7_L4X2lwxthzLyK9XLto',
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInR5cGUiOiJSRUZSRVNIX1RPS0VOIiwicm9sZSI6IlVTRVIiLCJpYXQiOjE3MzcxODI2MTksImV4cCI6MTczNzI2OTAxOX0.hxT3bh43uyiiNOgv32xVf3S2MEBtvm8NYOnlROytkks',
      },
      timestamp: '18/01/2025 13:43:39',
      path: '/api/core/v1/auth/login',
      traceId: '6d16c905-c4e9-446e-bc3f-05cdaa06404c',
    },
  },
};
