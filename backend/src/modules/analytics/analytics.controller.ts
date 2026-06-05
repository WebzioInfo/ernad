import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OeeService } from './services/oee.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly oeeService: OeeService
  ) {}

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

  @Get('historical')
  @Permissions('analytics:view')
  async getHistoricalPerformance(
    @Query('lineId') lineId?: string,
    @Query('brandId') brandId?: string,
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval: 'hour' | 'day' | 'week' = 'day'
  ) {
    return this.analyticsService.getHistoricalPerformance(
      lineId, 
      brandId, 
      productId, 
      startDate ? new Date(startDate) : undefined, 
      endDate ? new Date(endDate) : undefined,
      interval
    );
  }

  @Get('kpis')
  @Permissions('analytics:view')
  async getAggregatedKPIs(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.analyticsService.getAggregatedKPIs(
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('factory/live')
  @Permissions('analytics:view')
  async getFactoryOverview(@Query('timeRange') timeRange?: string) {
    return this.analyticsService.getFactoryOverview(timeRange);
  }

  @Get('factory/efficiency')
  @Permissions('analytics:view')
  async getMachineEfficiency() {
    return this.analyticsService.getMachineEfficiency();
  }

  @Get('batch/production-time')
  @Permissions('analytics:view')
  async getProductionTimeStats(@Query('batchId') batchId: string) {
    return this.analyticsService.getProductionTimeStats(batchId);
  }

  @Get('oee/batch')
  @Permissions('analytics:view')
  async getBatchOee(@Query('batchId') batchId: string) {
    return this.oeeService.calculateBatchOee(batchId);
  }

  @Get('oee/line')
  @Permissions('analytics:view')
  async getLineOee(@Query('lineId') lineId: string, @Query('days') days?: number) {
    return this.oeeService.getLineOee(lineId, days);
  }
}
