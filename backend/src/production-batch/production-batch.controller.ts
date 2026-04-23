import { Controller, Post, Body, Param, Put, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductionBatchService } from './production-batch.service';

import { RolesGuard } from '../auth/roles.guard'; 
import { Roles } from '../auth/roles.decorator';
import { AuthGuard } from '../auth/auth.guard';


@ApiTags('Production Batch')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('production-batch')

export class ProductionBatchController {
  constructor(private readonly batchService: ProductionBatchService) {}

  @Post('start')
  @Roles('SUPER_ADMIN', 'MANAGER')

  async startBatch(@Body() dto: { lineId: string; brandId: string; productId: string; shiftId: string }) {
    return await this.batchService.startBatch(dto.lineId, dto.brandId, dto.productId, dto.shiftId);
  }

  @Post(':id/changeover')
  @Roles('SUPER_ADMIN', 'MANAGER')

  async initiateChangeover(
    @Param('id') batchId: string, 
    @Body() dto: { toProductId: string; userId: string }
  ) {
    return await this.batchService.initiateChangeover(batchId, dto.toProductId, dto.userId);
  }

  @Put(':id/close')
  @Roles('SUPER_ADMIN', 'MANAGER')

  async closeBatch(@Param('id') batchId: string) {
    await this.batchService.closeBatch(batchId);
    return { success: true, message: 'Batch closed successfully.' };
  }

  @Get('active/:lineId')
  @ApiOperation({ summary: 'Get the active batch for a production line' })
  async getActiveBatch(@Param('lineId') lineId: string) {
    return await this.batchService.getActiveBatchByLine(lineId);
  }

  @Post('historical')
  @Roles('SUPER_ADMIN', 'MANAGER')
  async createHistoricalBatch(@Body() dto: any) {
    return await this.batchService.createHistoricalBatch(dto);
  }

  @Post('log-historical')
  @Roles('SUPER_ADMIN', 'MANAGER')
  async addStationLog(@Body() dto: { station: string; payload: any }) {
    return await this.batchService.addStationLog(dto.station, dto.payload);
  }
}
