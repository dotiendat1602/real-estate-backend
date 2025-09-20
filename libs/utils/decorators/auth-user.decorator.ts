import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export function AuthUser() {
  return createParamDecorator((_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (user?.[Symbol.for('isPublic')]) {
      return;
    }

    return user;
  })();
}

// export function AuthNatsUser() {
//   return createParamDecorator((_data: unknown, context: ExecutionContext) => {
//     const natsContext = context.switchToRpc().getContext<NatsContext>();
//     const value = natsContext.getHeaders()['headers'].get('x-user');

//     if (!value) {
//       return;
//     }

//     const user = Array.isArray(value) ? JSON.parse(value[0]) : JSON.parse(value);

//     return ConvertRawToModel.toUser(user);
//   })();
// }
