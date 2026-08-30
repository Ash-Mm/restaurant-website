import { writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantGuard } from '../auth/tenant.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { RestaurantId } from '../auth/restaurant.decorator.js';

interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
}

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Controller('admin')
@UseGuards(TenantGuard, JwtAuthGuard, PermissionsGuard)
export class UploadController {
  @Post('upload')
  @RequirePermissions('settings:write')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @RestaurantId() restaurantId: string,
    @UploadedFile() file: UploadedFilePayload | undefined
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file provided');
    }
    const ext = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.'))
      : '';
    const filename = `${restaurantId}-${randomUUID()}${ext}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return { url: `/uploads/${filename}` };
  }
}
