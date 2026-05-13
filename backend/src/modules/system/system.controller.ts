import { Controller, Post, Query, Get, UseGuards, Version } from '@nestjs/common';
import { SystemService } from './system.service';
import { ApiOperation, ApiTags, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';

@ApiTags('System Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post('maintenance/cleanup')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Manually trigger data cleanup/archiving' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Archive data older than X days' })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  async triggerCleanup(
    @Query('days') days?: number,
    @Query('dryRun') dryRun?: string
  ) {
    const isDryRun = dryRun === 'true';
    await this.systemService.runCleanup(days || 90, isDryRun);
    return { message: 'Cleanup process initiated', dryRun: isDryRun };
  }
}
