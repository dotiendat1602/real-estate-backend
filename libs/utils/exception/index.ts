import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCustom, ErrorValues } from '../enum';
export class CustomExceptionFactory extends HttpException {
  constructor(
    errorValue: ErrorValues,
    devMessage?: string | any,
    statusCode?: HttpStatus,
    payload?: any,
  ) {
    const errorObject = {
      errorValue,
      statusCode: statusCode || HttpStatus.BAD_REQUEST,
      devMessage: undefined,
      payload: undefined,
    };

    if (devMessage) errorObject.devMessage = devMessage;
    if (payload) errorObject.payload = payload;

    super(errorObject, errorObject.statusCode);
  }
}

export class Exception extends CustomExceptionFactory {
  /**
   *
   * @example
   *
   *   throw Exception("Something_Went_Wrong")
   *
   *   throw Exception("Something_Went_Wrong", "This is error description")
   *
   *   throw Exception("Something_Went_Wrong", "This is error description", HttpStatus.BAD_REQUEST)
   *
   *   throw Exception("Something_Went_Wrong", "This is error description", HttpStatus.BAD_REQUEST, { isSystem: true })
   */
  constructor(
    errorValue: ErrorValues,
    devMessage?: string | any,
    payload?: any,
    statusCode?: HttpStatus,
  ) {
    super(errorValue, devMessage, statusCode, payload);
  }
}

export class Forbidden extends CustomExceptionFactory {
  /**
   *
   * @example
   *
   *    // Common forbidden error
   *    throw Forbidden()
   *
   *    // Forbidden with description message
   *    throw Forbidden("This is error description")
   *
   *    // Forbidden with description message & payload data
   *    throw Forbidden("This is error description", { payload: "This is payload" })
   */
  constructor(devMessage?: string | any, payload?: any) {
    super(
      ErrorCustom.Forbidden_Resource,
      devMessage,
      HttpStatus.FORBIDDEN,
      payload,
    );
  }
}

export class Unauthorized extends CustomExceptionFactory {
  /**
   *
   * @example
   *
   *    // Common forbidden error
   *    throw Unauthorized()
   *
   *    // Unauthorized with description message
   *    throw Unauthorized("This is error description")
   *
   *    // Unauthorized with description message & payload data
   *    throw Unauthorized("This is error description", { payload: "This is payload" })
   */
  constructor(devMessage?: string | any, payload?: any) {
    super(
      ErrorCustom.Unauthorized,
      devMessage,
      HttpStatus.UNAUTHORIZED,
      payload,
    );
  }
}

export class UnprocessableEntity extends CustomExceptionFactory {
  /**
   *
   * @example
   *
   *    // Common forbidden error
   *    throw UnprocessableEntity()
   *
   *    // UnprocessableEntity with description message
   *    throw UnprocessableEntity("This is error description")
   *
   *    // UnprocessableEntity with description message & payload data
   *    throw UnprocessableEntity("This is error description", { payload: "This is payload" })
   */
  constructor(devMessage?: string | any, payload?: any) {
    super(
      ErrorCustom.Invalid_Input,
      devMessage,
      HttpStatus.UNPROCESSABLE_ENTITY,
      payload,
    );
  }
}
