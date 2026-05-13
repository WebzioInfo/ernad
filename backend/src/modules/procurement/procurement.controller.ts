import { Controller, Get, Post, Body, UseGuards, Req, Param, Patch } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Procurement Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('vendors')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'List all vendors' })
  async getVendors() {
    return await this.procurementService.getVendors();
  }

  @Post('vendors')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Register a new vendor' })
  async createVendor(@Body() dto: any) {
    return await this.procurementService.createVendor(dto);
  }

  @Get('purchase-orders')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'List all purchase orders' })
  async getPurchaseOrders() {
    return await this.procurementService.getPurchaseOrders();
  }

  @Post('purchase-orders')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Create a new purchase order' })
  async createPO(@Body() dto: any, @Req() req: any) {
    return await this.procurementService.createPurchaseOrder(dto, req.user.id);
  }

  @Get('goods-receipts')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'List all goods receipts (GRNs)' })
  async getGoodsReceipts() {
    return await this.procurementService.getGoodsReceipts();
  }

  @Post('goods-receipts')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Log a new goods receipt (GRN)' })
  async createGRN(@Body() dto: any, @Req() req: any) {
    return await this.procurementService.createGoodsReceipt(dto, req.user.id);
  }
}
