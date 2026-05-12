import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Get, Query, UseGuards, Param, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Enterprise Reporting')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) { }

  private validateDates(start: string, end: string) {
    if (!start || !end) {
      throw new BadRequestException('Start date and End date are required parameters.');
    }
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD or ISO strings.');
    }
    return { startDate: s, endDate: e };
  }

  @Get('production')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get comprehensive production analytics' })
  async getProductionReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('lineId') lineId?: string,
    @Query('brandId') brandId?: string,
    @Query('productId') productId?: string
  ) {
    const dates = this.validateDates(startDate, endDate);
    return this.reportsService.getProductionReport({
      ...dates,
      lineId,
      brandId,
      productId
    });
  }

  @Get('batches')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get list of production batches' })
  async getProductionBatches(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    this.validateDates(startDate, endDate);
    return this.reportsService.getProductionBatches({ startDate, endDate });
  }

  @Get('batch/:id')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get immutable batch dossier' })
  async getBatchDossier(@Param('id') id: string) {
    return this.reportsService.getBatchDossier(id);
  }

  @Get('sales')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get sales and revenue analytics' })
  async getSalesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    this.logger.log(`[SALES_REPORT] Request for range: ${startDate} - ${endDate}`);
    const dates = this.validateDates(startDate, endDate);
    return this.reportsService.getSalesReport(dates);
  }

  @Get('attendance')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get detailed attendance report' })
  async getAttendanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    this.validateDates(startDate, endDate);
    return this.reportsService.getAttendanceReport({ startDate, endDate });
  }
}
