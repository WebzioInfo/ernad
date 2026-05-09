import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Enterprise Reporting')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

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
    return this.reportsService.getProductionReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      lineId,
      brandId,
      productId
    });
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
    return this.reportsService.getSalesReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });
  }

  @Get('attendance')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get detailed attendance report' })
  async getAttendanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.reportsService.getAttendanceReport({ startDate, endDate });
  }
}
