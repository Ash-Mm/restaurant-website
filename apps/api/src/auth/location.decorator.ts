import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRequest } from './request.types.js';

export const LocationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    return req.locationId;
  }
);
