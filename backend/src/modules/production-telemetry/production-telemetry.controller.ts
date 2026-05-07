import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Post, Body, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { ProductionTelemetryDto } from './dto/production-telemetry.dto';

import { IngestionService } from './services/ingestion.service';

@ApiTags('Production Telemetry')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('telemetry')
export class ProductionTelemetryController {
  constructor(private readonly ingestionService: IngestionService) {}
  
  @Post()
  @Permissions('telemetry:log')
  @ApiOperation({ summary: 'Create a unified production log entry' })
  async createLog(@Request() req, @Body() dto: ProductionTelemetryDto) {
    return this.ingestionService.createLog(req.user.sub, dto);
  }

  // Legacy individual endpoints (delegated to unified logic)
  @Post('blowing')
  @Permissions('telemetry:log')
  async logBlowing(@Request() req, @Body() dto: any) {
    return this.ingestionService.createLog(req.user.sub, { ...dto, station: 'BLOWING' });
  }

  @Post('filling')
  @Permissions('telemetry:log')
  async logFilling(@Request() req, @Body() dto: any) {
    return this.ingestionService.createLog(req.user.sub, { ...dto, station: 'FILLING' });
  }

  @Post('labeling')
  @Permissions('telemetry:log')
  async logLabeling(@Request() req, @Body() dto: any) {
    return this.ingestionService.createLog(req.user.sub, { ...dto, station: 'LABELING' });
  }

  @Post('packing')
  @Permissions('telemetry:log')
  async logPacking(@Request() req, @Body() dto: any) {
    return this.ingestionService.createLog(req.user.sub, { ...dto, station: 'PACKING' });
  }
}

