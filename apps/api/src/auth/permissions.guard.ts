import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRepository } from './auth.repository.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import { hasPermission, parsePermissions } from './permissions.util.js';
import type { AppRequest } from './request.types.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly repo: AuthRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AppRequest>();
    const user = req.user;
    if (!user) {
      // JwtAuthGuard must run before this guard.
      throw new ForbiddenException('Missing authenticated user');
    }
    const restaurantId = req.restaurantId;
    if (!restaurantId) {
      // TenantGuard must run before this guard.
      throw new ForbiddenException('Missing tenant context');
    }

    // Tenant isolation: the identity in the signed token must belong to the
    // restaurant resolved from the request, never a different one.
    if (user.restaurantId !== restaurantId) {
      throw new ForbiddenException('Cross-tenant access denied');
    }

    const role = await this.repo.findRole(user.restaurantId, user.role);
    const granted = parsePermissions(role?.permissions ?? null);
    if (required.every((p) => hasPermission(granted, p))) {
      return true;
    }
    throw new ForbiddenException('Insufficient permissions');
  }
}

export { hasPermission } from './permissions.util.js';
