import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRequest } from './request.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    return req.user;
  }
);
