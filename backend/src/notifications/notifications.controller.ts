import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class RegisterTokenDto {
  userId: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
}

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getUnread() {
    return this.notificationsService.getUnreadNotifications();
  }

  @Post(':id/read')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  // ── OneSignal token management ──
  @Post('tokens')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR')
  async registerToken(@Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(dto.userId, dto.token, dto.platform);
  }

  @Delete('tokens/:token')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR')
  async removeToken(@Param('token') token: string) {
    await this.notificationsService.removeToken(token);
    return { success: true };
  }
}
