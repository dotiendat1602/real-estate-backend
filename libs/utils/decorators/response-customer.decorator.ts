import { applyDecorators } from '@nestjs/common';
import { ApiResponse, ApiResponseOptions } from '@nestjs/swagger';

/**
 * Custom decorator to handle multiple @ApiResponse decorators
 * @param responses - Array of ApiResponseOptions
 */
export function ApiResponseCustom(responses: ApiResponseOptions[]) {
  return applyDecorators(...responses.map((response) => ApiResponse(response)));
}
