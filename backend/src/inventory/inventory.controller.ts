import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';

@ApiTags('Inventory Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get global inventory levels' })
  async getInventory() {
    return await this.inventoryService.getInventory();
  }

  @Get(':id/ledger')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'Get transaction ledger for a material' })
  async getMaterialLedger(@Param('id') id: string) {
    return await this.inventoryService.getMaterialLedger(id);
  }

  @Post('stock')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update stock levels (IN/OUT/ADJUSTMENT)' })
  async updateStock(@Req() req: any, @Body() dto: any) {
    return await this.inventoryService.updateStock(req.user.factoryId, dto);
  }

  @Post('materials')
  @Permissions('settings:manage')
  @ApiOperation({ summary: 'Define a new raw material' })
  async createMaterial(@Req() req: any, @Body() dto: any) {
    return await this.inventoryService.createMaterial(req.user.factoryId, dto);
  }
}
