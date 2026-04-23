import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('api/analytics')



export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('line-performance')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getLinePerformance(@Query('lineId') lineId: string, @Query('shiftId') shiftId?: string) {
    return this.analyticsService.getLinePerformance(lineId, shiftId);
  }

  @Get('filling-anomalies')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getFillingAnomalies(@Query('batchId') batchId: string) {
    return this.analyticsService.getFillingAnomalies(batchId);
  }

  @Get('global-efficiency')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getGlobalEfficiency() {
    return this.analyticsService.getGlobalEfficiency();
  }

  @Get('predictive-insights')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getPredictiveInsights(@Query('batchId') batchId: string) {
    return this.analyticsService.getPredictiveInsights(batchId);
  }

}
