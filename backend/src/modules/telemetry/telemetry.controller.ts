import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Controller, Post, Body, UseGuards, UseInterceptors, Request, Get, Param, Patch, Delete, Query, ParseIntPipe, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { TelemetryDto } from './dto/telemetry.dto';

import { IngestionService } from './services/ingestion.service';
import { ProductionReconciliationService } from './services/production-reconciliation.service';
import { ProcessingService } from './services/processing.service';
import { TerminalService } from '../production/services/terminal.service';

@ApiTags('Telemetry')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('telemetry')
export class TelemetryController {
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
  async getReconciliation(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.reconciliationService.getBatchReconciliation(batchId);
  }

  @Get('history/:batchId/:station')
  @Permissions('telemetry:log')
  @ApiOperation({ summary: 'Get telemetry history for a batch and station' })
  async getHistory(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Param('station') station: string,
    @Query('operatorView') operatorView?: string,
  ) {
    try {
      const isOperatorView = operatorView === 'true';
      return await this.ingestionService.getLogHistory(batchId, station, isOperatorView);
    } catch (err) {
      return [];
    }
  }

  @Get('active-events/:batchId')
  @Permissions('telemetry:log')
  @ApiOperation({ summary: 'Get active downtime events for a batch' })
  async getActiveEvents(@Param('batchId', ParseUUIDPipe) batchId: string) {
    try {
      return await this.processingService.getActiveEvents(batchId);
    } catch (err) {
      return [];
    }
  }

  @Get('logs')
  @Permissions('analytics:view')
  @ApiOperation({ summary: 'Get all production logs with advanced filtering (Manager portal)' })
  async getAllLogs(@Query() query: any) {
    return this.processingService.getAllLogs(query);
  }

  @Post('logs')
  @Permissions('telemetry:log')
  @ApiOperation({ summary: 'Create a unified production log entry' })
  async createLog(@Request() req, @Body() dto: TelemetryDto) {
    return this.ingestionService.createLog(req.user.sub, dto);
  }

  @Post('logs/manual')
  @Permissions('analytics:manage')
  @ApiOperation({ summary: 'Create a manual production log entry (Manager/Admin correction)' })
  async createManualLog(@Request() req, @Body() dto: TelemetryDto) {
    return this.processingService.createManualLog(req.user.sub, dto);
  }

  @Patch('logs/:id')
  @Permissions('analytics:manage')
  @ApiOperation({ summary: 'Update a production log entry (Manager only)' })
  async patchLog(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { primaryCount?: number; wastageCount?: number; remarks?: string; rawMaterialId?: string | null; bagsUsed?: number; capBoxUsage?: number; labelsUsed?: number; shrinkRollsUsed?: number }
  ) {
    return this.processingService.updateLog(id, req.user.sub, dto);
  }

  @Delete('logs/:id')
  @Permissions('analytics:manage')
  @ApiOperation({ summary: 'Void a production log entry' })
  async voidLog(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string }
  ) {
    return this.processingService.voidLog(id, req.user.sub, body.reason);
  }
}
