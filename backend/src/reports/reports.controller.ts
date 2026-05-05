import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Production Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('reports')


export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('shift-production')
  @Permissions('reports:view')

  async getShiftReport(@Query('shiftId') shiftId: string) {
    return this.reportsService.generateShiftReport(shiftId);
  }

  @Get('line-efficiency')
  @Permissions('reports:view')

  async getLineEfficiency() {
    return this.reportsService.getLineEfficiency();
  }

  @Get('material-consumption')
  @Permissions('reports:view')

  async getMaterialConsumption(@Query('batchId') batchId: string) {
    return this.reportsService.getMaterialConsumption(batchId);
  }
}
