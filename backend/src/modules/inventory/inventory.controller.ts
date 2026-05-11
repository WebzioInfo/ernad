import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
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
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get global inventory levels' })
  async getInventory() {
    return await this.inventoryService.getInventory();
  }

  @Get('warehouses')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get all warehouse locations' })
  async getWarehouses() {
    return await this.inventoryService.getWarehouses();
  }

  @Get('categories')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get all material categories' })
  async getCategories() {
    return await this.inventoryService.getCategories();
  }

  @Get('packaging/:productId')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get packaging configurations for a product' })
  async getPackagingConfigs(@Param('productId') productId: string) {
    return await this.inventoryService.getPackagingConfigs(productId);
  }

  @Get(':id/ledger')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get transaction ledger for a stock item' })
  async getMaterialLedger(@Param('id') id: string) {
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
}
