import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ParseUUIDPipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Inventory Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get global inventory levels' })
  async getInventory() {
    return await this.inventoryService.getInventory();
  }

  @Get('warehouses')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get all warehouse locations' })
  async getWarehouses() {
    return await this.inventoryService.getWarehouses();
  }

  @Get('stock')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get all inventory stock items' })
  async getStock() {
    return await this.inventoryService.getInventory();
  }

  @Get('stock/category/:category')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get stock items by category name' })
  async getStockByCategory(@Param('category') category: string) {
    return await this.inventoryService.getStockByCategory(category);
  }



  @Post('warehouses')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Create a new warehouse location' })
  async createWarehouse(@Body() dto: { name: string; type: string }) {
    return await this.inventoryService.createWarehouse(dto);
  }

  @Get('packaging/:productId')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get packaging configurations for a product' })
  async getPackagingConfigs(@Param('productId', ParseUUIDPipe) productId: string) {
    return await this.inventoryService.getPackagingConfigs(productId);
  }

  @Get(':id/ledger')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get transaction ledger for a stock item' })
  async getMaterialLedger(@Param('id', ParseUUIDPipe) id: string) {
    return await this.inventoryService.getMaterialLedger(id);
  }

  @Post('stock')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update stock levels (IN/OUT/ADJUSTMENT)' })
  async updateStock(@Body() dto: any, @Req() req: any) {
    return await this.inventoryService.updateStock({
      ...dto,
      performedBy: req.user.id
    });
  }

  @Post('items')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Define a new inventory stock item' })
  async createStockItem(@Body() dto: any) {
    return await this.inventoryService.createStockItem(dto);
  }

  // ─── NEW SIMPLE INVENTORY ENDPOINTS ─────────────────────────────────

  @Get('raw-materials')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN', 'ACCOUNTANT')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get raw material stocks' })
  async getRawMaterials() {
    return await this.inventoryService.getRawMaterials();
  }

  @Get('raw-materials/:id/ledger')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get ledger for raw material' })
  async getRawMaterialLedger(@Param('id') id: string) {
    return await this.inventoryService.getRawMaterialLedger(id);
  }

  @Get('station-consumption')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get raw material consumption by station' })
  async getStationConsumption() {
    return await this.inventoryService.getStationConsumption();
  }

  @Get('production-stock')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get finished goods production stock' })
  async getProductionStock() {
    return await this.inventoryService.getProductionStock();
  }

  @Post('add-stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Add raw material or product stock (Admin & Manager)' })
  async addStock(@Body() body: { materialId?: string; itemId?: string; itemType?: 'RAW' | 'PRODUCT'; quantity: number; remarks?: string }, @Req() req: any) {
    const itemId = body.itemId || body.materialId;
    const itemType = body.itemType || 'RAW';
    if (!itemId) throw new Error('itemId or materialId is required');

    return await this.inventoryService.addStockTransaction({
      itemId,
      itemType,
      quantity: Number(body.quantity),
      remarks: body.remarks,
      performedBy: req.user.id || req.user.sub
    });
  }

  @Get('production-stock/:id/ledger')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get ledger for a product production stock' })
  async getProductLedger(@Param('id') id: string) {
    return await this.inventoryService.getProductLedger(id);
  }

  @Put('update-stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update raw material or product stock transaction (Admin & Manager)' })
  async updateStockTransaction(@Body() body: { transactionId: string; quantity: number; remarks?: string; itemType?: 'RAW' | 'PRODUCT' }, @Req() req: any) {
    return await this.inventoryService.updateStockTransaction({
      transactionId: body.transactionId,
      quantity: Number(body.quantity),
      remarks: body.remarks,
      performedBy: req.user.id || req.user.sub
    });
  }

  @Delete('delete-stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete raw material or product stock transaction (Admin & Manager)' })
  async deleteStockTransaction(@Body() body: { transactionId: string; itemType?: 'RAW' | 'PRODUCT' }, @Req() req: any) {
    return await this.inventoryService.deleteStockTransaction(body.transactionId);
  }
}
