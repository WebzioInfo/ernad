import { OperatorLogsService } from './operator-logs.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Controller, Post, Body, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';
import { CreateLogDto } from './dto/create-log.dto';

@ApiTags('Operator Logs')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('api/logs')
export class OperatorLogsController {
  constructor(private readonly logsService: OperatorLogsService) {}
  
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BLOWING_OPERATOR', 'FILLING_OPERATOR', 'LABELING_OPERATOR', 'PACKING_OPERATOR')
  @ApiOperation({ summary: 'Create a unified production log entry' })
  async createLog(@Request() req, @Body() dto: CreateLogDto) {
    return this.logsService.createLog(req.user.id, dto);
  }

  // Legacy individual endpoints (delegated to unified logic)
  @Post('blowing')
  @Roles('SUPER_ADMIN', 'BLOWING_OPERATOR')
  async logBlowing(@Request() req, @Body() dto: any) {
    return this.logsService.createLog(req.user.id, { ...dto, station: 'BLOWING' });
  }

  @Post('filling')
  @Roles('SUPER_ADMIN', 'FILLING_OPERATOR')
  async logFilling(@Request() req, @Body() dto: any) {
    return this.logsService.createLog(req.user.id, { ...dto, station: 'FILLING' });
  }

  @Post('labeling')
  @Roles('SUPER_ADMIN', 'LABELING_OPERATOR')
  async logLabeling(@Request() req, @Body() dto: any) {
    return this.logsService.createLog(req.user.id, { ...dto, station: 'LABELING' });
  }

  @Post('packing')
  @Roles('SUPER_ADMIN', 'PACKING_OPERATOR')
  async logPacking(@Request() req, @Body() dto: any) {
    return this.logsService.createLog(req.user.id, { ...dto, station: 'PACKING' });
  }
}
