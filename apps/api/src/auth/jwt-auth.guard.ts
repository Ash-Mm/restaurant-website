import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository.js';
import type { AppRequest } from './request.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly repo: AuthRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const rawToken = header.slice('Bearer '.length).trim();
    if (rawToken.length === 0) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: { sub?: unknown; restaurantId?: unknown };
    try {
      payload = await this.jwt.verifyAsync(rawToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.restaurantId !== 'string'
    ) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Tenant isolation: the user is looked up scoped by the restaurantId
    // claimed inside the signed token, never by client input.
    const user = await this.repo.findUserById(payload.restaurantId, payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    req.userId = user.id;
    req.restaurantId = user.restaurantId;
    req.user = user;
    return true;
  }
}
