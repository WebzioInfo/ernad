import { Controller, Post, Body, Param, Put, Get, UseGuards, Query, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BatchService } from './services/batch.service';
import { LineService } from './services/line.service';
import { LifecycleService } from './services/lifecycle.service';

import { Permissions } from '../auth/permissions.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { 
  StartBatchDto, 
  ChangeoverDto, 
  QualityCheckDto, 
  PackagingLogDto, 
  DispatchLogDto 
} from './dto/production-management.dto';

import { ChangeoverService } from './changeover.service';

@ApiTags('Production Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller(['production', 'production-batch'])
export class ProductionManagementController {
  private readonly logger = new Logger(ProductionManagementController.name);
  constructor(
    private readonly batchService: BatchService,
    private readonly lineService: LineService,
    private readonly lifecycleService: LifecycleService,
    private readonly changeoverService: ChangeoverService
  ) {}

  @Post('start')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Start a new production batch (Safe)' })
  async startBatch(@Req() req: any, @Body() dto: StartBatchDto) {
    return await this.batchService.startBatch(
      dto.lineId, 
      dto.brandId, 
      dto.productId, 
      dto.shiftId,
      req.user.sub,
      dto.batchCode,
      dto.remarks,
      dto.startTime
    );
  }

  @Post('qc')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Submit a quality check for a batch' })
  async submitQC(@Body() dto: QualityCheckDto) {
    return await this.lifecycleService.submitQualityCheck(
      dto.batchId,
      dto.inspectorId,
      dto.result,
      dto.parameters || {},
      dto.remarks
    );
  }

  @Post('packaging')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Log packaged units' })
  async logPackaging(@Body() dto: PackagingLogDto) {
    return await this.lifecycleService.logPackaging(
      dto.batchId,
      dto.operatorId,
      dto.packType,
      dto.quantity,
      dto.unitsPerPack,
      dto.remarks
    );
  }

  @Post('dispatch')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Log dispatch event' })
  async logDispatch(@Body() dto: DispatchLogDto) {
    return await this.lifecycleService.logDispatch(
      dto.batchId,
      dto.managerId,
      dto.destination,
      dto.quantity,
      dto.vehicleNumber || '',
      dto.remarks
    );
  }

  @Post('line/:id/changeover')
  @Permissions('production:close')
  @ApiOperation({ summary: 'Initiate a product changeover for a line' })
  async initiateChangeover(
    @Param('id') lineId: string, 
    @Req() req: any,
    @Body() dto: { batchId: string; productId: string }
  ) {
    return await this.changeoverService.initiateChangeover(dto.batchId, dto.productId, req.user.sub);
  }

  @Put(':id/close')
  @Permissions('production:close')
  async closeBatch(
    @Param('id') batchId: string,
    @Req() req: any,
    @Body() body: { remarks?: string; endTime?: string; materialReturn?: any }
  ) {
    await this.lifecycleService.closeBatch(batchId, req.user.sub, body.remarks, body.endTime, body.materialReturn);
    return { success: true, message: 'Batch moved to QC_PENDING.' };
  }

  @Post('batch/:id/complete-changeover')
  @Permissions('production:close')
  async completeChangeover(
    @Param('id') batchId: string,
    @Req() req: any
  ) {
    return await this.changeoverService.completeChangeover(batchId, req.user.sub);
  }

  @Post('line/:id/toggle-maintenance')
  @Permissions('production:close')
  async toggleMaintenance(
    @Param('id') lineId: string,
    @Req() req: any
  ) {
    return await this.lineService.toggleMaintenance(lineId, req.user.sub);
  }

  @Get('active/:lineId')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Get active batch for a specific line' })
  async getActiveBatch(@Param('lineId') lineId: string) {
    try {
      return await this.batchService.getActiveBatch(lineId);
    } catch (err) {
      this.logger.error(`Failed to get active batch for line ${lineId}: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Get('batches')
  @Permissions('production:start')
  @ApiOperation({ summary: 'List recent production batches' })
  async getBatches(
    @Req() req: any
  ) {
    return await this.batchService.getBatches();
  }

  @Get('logs/:type')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Get lifecycle logs (qc, packaging, dispatch)' })
  async getLifecycleLogs(
    @Req() req: any,
    @Param('type') type: 'qc' | 'packaging' | 'dispatch'
  ) {
    return await this.lifecycleService.getLifecycleLogs(type);
  }
}
