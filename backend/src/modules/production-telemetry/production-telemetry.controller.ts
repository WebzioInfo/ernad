import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Post, Body, UseGuards, UseInterceptors, Request, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { ProductionTelemetryDto } from './dto/production-telemetry.dto';

import { IngestionService } from './services/ingestion.service';
import { ProductionReconciliationService } from './services/production-reconciliation.service';
import { ProcessingService } from './services/processing.service';
import { TerminalService } from '../production-management/services/terminal.service';

@ApiTags('Production Telemetry')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller(['telemetry', 'production-telemetry'])
export class ProductionTelemetryController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly reconciliationService: ProductionReconciliationService,
    private readonly processingService: ProcessingService,
    private readonly terminalService: TerminalService
  ) {}

  @Post('verify-operator')
  @Permissions('telemetry:log')
  @ApiOperation({ summary: 'Verify operator PIN for terminal access' })
  async verifyOperator(@Body() dto: { operatorId: string; operatorPin: string }) {
    return this.terminalService.verifyOperatorForAction(dto.operatorId, dto.operatorPin);
  }
  
  @Get('reconciliation/:batchId')
  @Permissions('analytics:view')
  @ApiOperation({ summary: 'Get material vs production reconciliation for a batch' })
  async getReconciliation(@Param('batchId') batchId: string) {
    return this.reconciliationService.getBatchReconciliation(batchId);
  }

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

  @Get('history/:batchId/:station')
  @Permissions('telemetry:log')
  async getHistory(@Param('batchId') batchId: string, @Param('station') station: string) {
    return this.ingestionService.getLogHistory(batchId, station);
  }
  
  @Patch('logs/:id')
  @Permissions('analytics:manage')
  @ApiOperation({ summary: 'Update a production log entry (Manager only)' })
  async patchLog(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: { primaryCount?: number; wastageCount?: number; remarks?: string }
  ) {
    return this.processingService.updateLog(Number(id), req.user.sub, dto);
  }
}

