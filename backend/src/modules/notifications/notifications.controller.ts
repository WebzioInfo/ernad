import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';

import { IsString, IsNotEmpty, IsEnum, IsUUID } from 'class-validator';

class RegisterTokenDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(['web', 'android', 'ios'])
  platform: 'web' | 'android' | 'ios';
}

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  @Permissions('notifications:view')
  async getUnread() {
    return this.notificationsService.getUnreadNotifications();
  }

  @Post(':id/read')
  @Permissions('notifications:view')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  // ── OneSignal token management ──
  @Post('tokens')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR')
  async registerToken(@Body() dto: RegisterTokenDto) {
    try {
      const record = await this.notificationsService.registerToken(dto.userId, dto.token, dto.platform);
      return { success: true, data: record };
    } catch (err: any) {
      // Non-critical — push notifications will still work via OneSignal's server
      // but we won't have the token tracked in our own DB.
      console.warn('[NotificationsController] Token registration skipped:', err.message);
      return { success: false, warning: 'Token could not be stored. Push delivery may be affected.' };
    }
  }

  @Delete('tokens/:token')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR')
  async removeToken(@Param('token') token: string) {
    await this.notificationsService.removeToken(token);
    return { success: true };
  }
}
