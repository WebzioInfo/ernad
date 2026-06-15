import { Controller, Get, Query, Param, UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { WastageService } from './wastage.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Wastage Intelligence')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('wastage-intelligence')
export class WastageController {
  private readonly logger = new Logger(WastageController.name);

  constructor(private readonly wastageService: WastageService) {}

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

  @Get()
  @Roles('ADMIN')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get aggregated wastage intelligence metrics' })
  async getWastageDashboardData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('lineId') lineId?: string,
    @Query('productId') productId?: string,
    @Query('batchCode') batchCode?: string
  ) {
    this.logger.log(`[WASTAGE_CONTROLLER] Dashboard fetch request. Line: ${lineId || 'all'}, Product: ${productId || 'all'}, BatchCode: ${batchCode || 'all'}`);
    const dates = this.validateDates(startDate, endDate);
    return this.wastageService.getWastageDashboardData({
      ...dates,
      lineId,
      productId,
      batchCode
    });
  }

  @Get('batch/:id')
  @Roles('ADMIN')
  @Permissions('reports:view')
  @ApiOperation({ summary: 'Get details for a single batch wastage drilldown' })
  async getBatchWastageDetails(@Param('id') id: string) {
    this.logger.log(`[WASTAGE_CONTROLLER] Batch drilldown details request for batchId: ${id}`);
    if (!id) throw new BadRequestException('batchId parameter is required');
    const details = await this.wastageService.getBatchWastageDetails(id);
    if (!details) {
      throw new BadRequestException(`Batch with ID ${id} not found.`);
    }
    return details;
  }
}
