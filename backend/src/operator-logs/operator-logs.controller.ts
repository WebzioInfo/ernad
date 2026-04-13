import { Controller, Post, Body } from '@nestjs/common';
import { OperatorLogsService } from './operator-logs.service';

@Controller('api/logs')
export class OperatorLogsController {
  constructor(private readonly logsService: OperatorLogsService) {}
  
  @Post('blowing')
  async logBlowing(@Body() dto: any) {
    return this.logsService.logBlowing(dto);
  }

  @Post('filling')
  async logFilling(@Body() dto: any) {
    return this.logsService.logFilling(dto);
  }

  @Post('labeling')
  async logLabeling(@Body() dto: any) {
    return this.logsService.logLabeling(dto);
  }

  @Post('packing')
  async logPacking(@Body() dto: any) {
    return this.logsService.logPacking(dto);
  }
}
