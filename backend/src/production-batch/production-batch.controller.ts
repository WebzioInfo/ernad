import { Controller, Post, Body, Param, Put, Get, UseGuards } from '@nestjs/common';
import { ProductionBatchService } from './production-batch.service';

// Pseudo-code for guard import
// import { RolesGuard } from '../auth/roles.guard'; 
// import { Roles } from '../auth/roles.decorator';

@Controller('api/production-batch')
export class ProductionBatchController {
  constructor(private readonly batchService: ProductionBatchService) {}

  @Post('start')
  // @Roles('MANAGER', 'ADMIN')
  async startBatch(@Body() dto: { lineId: string; brandId: string; productId: string; shiftId: string }) {
    return await this.batchService.startBatch(dto.lineId, dto.brandId, dto.productId, dto.shiftId);
  }

  @Post(':id/changeover')
  // @Roles('MANAGER')
  async initiateChangeover(
    @Param('id') batchId: string, 
    @Body() dto: { toProductId: string; userId: string }
  ) {
    return await this.batchService.initiateChangeover(batchId, dto.toProductId, dto.userId);
  }

  @Put(':id/close')
  // @Roles('MANAGER', 'ADMIN')
  async closeBatch(@Param('id') batchId: string) {
    await this.batchService.closeBatch(batchId);
    return { success: true, message: 'Batch closed successfully.' };
  }
}

// Separate controller for high-volume logs
@Controller('api/logs')
export class OperatorLogsController {
  
  @Post('filling')
  // @Roles('FILLING_OPERATOR')
  async logFilling(@Body() dto: { batchId: string; operatorId: string; bottleCount: number; capWastage: number }) {
    // Calling an assumed OperatorLogsService
    // Return fast 201 Created responding to the operator touch panel
    return { success: true, loggedAt: new Date() };
  }
}
