import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { DashboardService, DashboardTimeRange } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Permissions('analytics:view')
  @ApiOperation({ summary: 'Get manager dashboard overview from ERP records' })
  @ApiQuery({ name: 'timeRange', required: false, enum: ['live', 'today', 'week', 'month'] })
  getOverview(@Query('timeRange') timeRange: DashboardTimeRange = 'today') {
    return this.dashboardService.getOverview(timeRange);
  }
}
