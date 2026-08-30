import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CustomersService } from './customers.service.js';
import {
  guestSessionSchema,
  resolveGuestSchema,
  type GuestSessionDto,
  type ResolveGuestDto,
} from './dto/guest-session.dto.js';
import type { GuestSession, PublicCustomer } from './customers.service.js';

@Controller('public')
export class GuestsController {
  constructor(private readonly service: CustomersService) {}

  @Post(':slug/guest-session')
  @HttpCode(201)
  createSession(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(guestSessionSchema)) dto: GuestSessionDto
  ): Promise<GuestSession> {
    return this.service.createGuestSessionForSlug(slug, dto);
  }

  @Post('guest/resolve')
  @HttpCode(200)
  resolve(
    @Body(new ZodValidationPipe(resolveGuestSchema)) dto: ResolveGuestDto
  ): Promise<{ customer: PublicCustomer }> {
    return this.service.resolveTrackingTokenForSlug(dto.restaurantSlug, dto.trackingToken).then(
      (customer) => ({ customer })
    );
  }
}
