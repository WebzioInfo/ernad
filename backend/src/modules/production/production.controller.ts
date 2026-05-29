import { Controller, Post, Body, Param, Put, Get, UseGuards, Query, Req, Logger, UseInterceptors, Patch, NotFoundException } from '@nestjs/common';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BatchService } from './services/batch.service';
import { LineService } from './services/line.service';
import { LifecycleService } from './services/lifecycle.service';

import { Permissions } from '../auth/permissions.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { 
  StartBatchDto, 
  LogDowntimeDto,
  PackagingLogDto, 
  DispatchLogDto 
} from './dto/production.dto';

import { ChangeoverService } from './changeover.service';
import { VerificationService } from './services/verification.service';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('production')
export class ProductionController {
  private readonly logger = new Logger(ProductionController.name);
  constructor(
    private readonly batchService: BatchService,
    private readonly lineService: LineService,
    private readonly lifecycleService: LifecycleService,
    private readonly changeoverService: ChangeoverService,
    private readonly verificationService: VerificationService
  ) {}

  @Post('batches/start')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Start a new production batch' })
  async startBatch(@Req() req: any, @Body() dto: StartBatchDto) {
    return await this.batchService.startBatch(
      dto.lineId, 
      dto.brandId, 
      dto.productId, 
      dto.shiftId,
      req.user.sub,
      dto.batchCode,
      dto.remarks,
      dto.startTime,
      dto.operatorIds,
      dto.targetQuantity
    );
  }

  @Post('batches/:id/reopen')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Reopen a completed/closed batch for correction' })
  async reopenBatch(
    @Param('id') batchId: string,
    @Req() req: any,
    @Body() body: { reason: string }
  ) {
    return await this.lifecycleService.reopenBatch(batchId, req.user.sub, body.reason);
  }

  @Post('batches/:id/reassign-operators')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Reassign operators to a running batch' })
  async reassignOperators(
    @Param('id') batchId: string,
    @Req() req: any,
    @Body() body: { operatorIds: string[] }
  ) {
    return await this.lifecycleService.reassignOperators(batchId, req.user.sub, body.operatorIds);
  }

  @Post('packaging-logs')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Log packaged units' })
  async logPackaging(@Req() req: any, @Body() dto: PackagingLogDto) {
    return await this.lifecycleService.logPackaging(
      dto.batchId,
      req.user.sub,
      dto.packType,
      dto.quantity,
      dto.unitsPerPack,
      dto.remarks
    );
  }

  @Post('dispatch-logs')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Log dispatch event' })
  async logDispatch(@Req() req: any, @Body() dto: DispatchLogDto) {
    return await this.lifecycleService.logDispatch(
      dto.batchId,
      req.user.sub,
      dto.destination,
      dto.quantity,
      dto.vehicleNumber || '',
      dto.remarks
    );
  }

  @Post('lines/:id/changeover')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Initiate a product changeover for a line' })
  async initiateChangeover(
    @Param('id') lineId: string, 
    @Req() req: any,
    @Body() dto: { batchId: string; productId: string; reason?: string; notes?: string; startTime?: string }
  ) {
    return await this.changeoverService.initiateChangeover(dto.batchId, dto.productId, req.user.sub, { reason: dto.reason, notes: dto.notes, startTime: dto.startTime });
  }

  @Patch('batches/:id/close')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Close a production batch' })
  async closeBatch(
    @Param('id') batchId: string,
    @Req() req: any,
    @Body() body: { remarks?: string; endTime?: string; materialReturn?: any }
  ) {
    await this.lifecycleService.closeBatch(batchId, req.user.sub, body.remarks, body.endTime, body.materialReturn);
    return { success: true, message: 'Production session officially CLOSED and LOCKED.' };
  }

  @Post('batches/:id/request-approval')
  @Permissions('production:close')
  async requestApproval(
    @Param('id') batchId: string,
    @Req() req: any
  ) {
    return await this.lifecycleService.requestApproval(batchId, req.user.sub);
  }

  @Post('batches/:id/approve')
  @Permissions('production:close')
  async approveBatch(
    @Param('id') batchId: string,
    @Req() req: any
  ) {
    return await this.lifecycleService.approveBatch(batchId, req.user.sub);
  }

  @Patch('batches/:id/adjust-time')
  @Permissions('production:close')
  async adjustTime(
    @Param('id') batchId: string,
    @Req() req: any,
    @Body() body: { startTime?: string, endTime?: string, reason?: string }
  ) {
    return await this.lifecycleService.adjustBatchTime(batchId, req.user.sub, body.startTime, body.endTime, body.reason);
  }

  @Post('batches/:id/complete-changeover')
  @Permissions('production:start')
  async completeChangeover(
    @Param('id') batchId: string,
    @Req() req: any
  ) {
    return await this.changeoverService.completeChangeover(batchId, req.user.sub);
  }

  @Post('lines/:id/toggle-maintenance')
  @Permissions('production:close')
  async toggleMaintenance(
    @Param('id') lineId: string,
    @Req() req: any
  ) {
    return await this.lineService.toggleMaintenance(lineId, req.user.sub);
  }

  @Get('active-batch/:lineId')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Get active batch for a specific line' })
  async getActiveBatch(@Param('lineId') lineId: string) {
    return await this.batchService.getActiveBatch(lineId);
  }

  @Get('batches')
  @Permissions('production:start')
  @ApiOperation({ summary: 'List recent production batches' })
  async getBatches() {
    return await this.batchService.getBatches();
  }

  @Get('logs/:type')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Get lifecycle logs (qc, packaging, dispatch)' })
  async getLifecycleLogs(
    @Param('type') type: 'qc' | 'packaging' | 'dispatch'
  ) {
    return await this.lifecycleService.getLifecycleLogs(type);
  }

  @Post('logs/:id/verify')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Verify a production log' })
  async verifyLog(
    @Param('id') logId: string,
    @Req() req: any,
    @Body() body: { remarks?: string }
  ) {
    return await this.verificationService.verifyLog(Number(logId), req.user.sub, body.remarks);
  }

  @Post('logs/:id/reject')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Reject a production log' })
  async rejectLog(
    @Param('id') logId: string,
    @Req() req: any,
    @Body() body: { reason: string }
  ) {
    return await this.verificationService.rejectLog(Number(logId), req.user.sub, body.reason);
  }

  @Post('logs/:id/correct')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Correct a production log' })
  async correctLog(
    @Param('id') logId: string,
    @Req() req: any,
    @Body() body: { newData: any, reason: string }
  ) {
    return await this.verificationService.correctLog(Number(logId), req.user.sub, body.newData, body.reason);
  }
}
