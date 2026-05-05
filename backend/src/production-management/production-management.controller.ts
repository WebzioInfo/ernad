import { Controller, Post, Body, Param, Put, Get, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductionManagementService } from './production-management.service';

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

@ApiTags('Production Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller(['production', 'production-batch'])
export class ProductionManagementController {
  constructor(private readonly productionService: ProductionManagementService) {}

  @Post('start')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Start a new production batch (Safe)' })
  async startBatch(@Req() req: any, @Body() dto: StartBatchDto) {
    return await this.productionService.startBatch(
      dto.factoryId, 
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
    return await this.productionService.submitQualityCheck(
      dto.factoryId,
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
    return await this.productionService.logPackaging(
      dto.factoryId,
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
    return await this.productionService.logDispatch(
      dto.factoryId,
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
    return await this.productionService.initiateChangeover(dto.batchId, dto.productId, req.user.sub);
  }

  @Put(':id/close')
  @Permissions('production:close')
  async closeBatch(
    @Param('id') batchId: string,
    @Req() req: any,
    @Body() body: { remarks?: string },
    @Query('factoryId') factoryId?: string
  ) {
    const targetFactoryId = factoryId || req.user.factoryId;
    await this.productionService.closeBatch(targetFactoryId, batchId, req.user.sub, body.remarks);
    return { success: true, message: 'Batch moved to QC_PENDING.' };
  }

  @Post('batch/:id/complete-changeover')
  @Permissions('production:close')
  async completeChangeover(
    @Param('id') batchId: string,
    @Req() req: any,
    @Query('factoryId') factoryId?: string
  ) {
    const targetFactoryId = factoryId || req.user.factoryId;
    return await this.productionService.completeChangeover(targetFactoryId, batchId, req.user.sub);
  }

  @Post('line/:id/toggle-maintenance')
  @Permissions('production:close')
  async toggleMaintenance(
    @Param('id') lineId: string,
    @Req() req: any,
    @Query('factoryId') factoryId?: string
  ) {
    const targetFactoryId = factoryId || req.user.factoryId;
    return await this.productionService.toggleMaintenance(targetFactoryId, lineId, req.user.sub);
  }

  @Get('active/:lineId')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Get active batch for a specific line' })
  async getActiveBatch(@Param('lineId') lineId: string) {
    return await this.productionService.getActiveBatch(lineId);
  }

  @Get('batches')
  @Permissions('production:start')
  @ApiOperation({ summary: 'List recent production batches' })
  async getBatches(
    @Req() req: any,
    @Query('factoryId') factoryId?: string
  ) {
    const targetFactoryId = factoryId || req.user.factoryId;
    return await this.productionService.getBatches(targetFactoryId);
  }

  @Get('logs/:type')
  @Permissions('production:start')
  @ApiOperation({ summary: 'Get lifecycle logs (qc, packaging, dispatch)' })
  async getLifecycleLogs(
    @Req() req: any,
    @Param('type') type: 'qc' | 'packaging' | 'dispatch',
    @Query('factoryId') factoryId?: string
  ) {
    const targetFactoryId = factoryId || req.user.factoryId;
    return await this.productionService.getLifecycleLogs(targetFactoryId, type);
  }
}
