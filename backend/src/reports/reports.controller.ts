import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('reports')


export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('shift-production')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')

  async getShiftReport(@Query('shiftId') shiftId: string) {
    return this.reportsService.generateShiftReport(shiftId);
  }

  @Get('line-efficiency')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')

  async getLineEfficiency() {
    return this.reportsService.getLineEfficiency();
  }

  @Get('material-consumption')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')

  async getMaterialConsumption(@Query('batchId') batchId: string) {
    return this.reportsService.getMaterialConsumption(batchId);
  }
}
