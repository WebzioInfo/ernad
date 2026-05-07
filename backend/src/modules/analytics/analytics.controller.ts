import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('analytics')



export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('line-performance')
  @Permissions('analytics:view')
  async getLinePerformance(
    @Query('lineId') lineId: string, 
    @Query('shiftId') shiftId?: string,
    @Query('brandId') brandId?: string,
    @Query('productId') productId?: string
  ) {
    return this.analyticsService.getLinePerformance(lineId, shiftId, brandId, productId);
  }

  @Get('filling-anomalies')
  @Permissions('analytics:view')
  async getFillingAnomalies(@Query('batchId') batchId: string) {
    return this.analyticsService.getFillingAnomalies(batchId);
  }

  @Get('global-efficiency')
  @Permissions('analytics:view')
  async getGlobalEfficiency() {
    return this.analyticsService.getGlobalEfficiency();
  }

  @Get('predictive-insights')
  @Permissions('analytics:view')
  async getPredictiveInsights(@Query('batchId') batchId: string) {
    return this.analyticsService.getPredictiveInsights(batchId);
  }

  @Get('brands')
  @Permissions('analytics:view')
  async getBrandPerformance() {
    return this.analyticsService.getBrandPerformance();
  }

  @Get('products')
  @Permissions('analytics:view')
  async getProductPerformance() {
    return this.analyticsService.getProductPerformance();
  }
}
