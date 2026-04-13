import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('shift-production')
  async getShiftReport(@Query('shiftId') shiftId: string) {
    return this.reportsService.generateShiftReport(shiftId);
  }

  @Get('line-efficiency')
  async getLineEfficiency() {
    return this.reportsService.getLineEfficiency();
  }

  @Get('material-consumption')
  async getMaterialConsumption(@Query('batchId') batchId: string) {
    return this.reportsService.getMaterialConsumption(batchId);
  }
}
