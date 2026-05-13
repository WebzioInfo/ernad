import { Controller, Get, Post, Body, UseGuards, Req, Param, Patch } from '@nestjs/common';
import { WarehousingService } from './warehousing.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Warehousing Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('inventory/warehousing')
export class WarehousingController {
  constructor(private readonly warehousingService: WarehousingService) {}

  @Get('locations')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'List all warehouse locations' })
  async getLocations() {
    return await this.warehousingService.getWarehouses();
  }

  @Get('transfers')
  @Permissions('inventory:view')
  @ApiOperation({ summary: 'List all stock transfers' })
  async getTransfers() {
    return await this.warehousingService.getTransfers();
  }

  @Post('transfers')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Initiate a new stock transfer between locations' })
  async createTransfer(@Body() dto: any, @Req() req: any) {
    return await this.warehousingService.initiateTransfer(dto, req.user.id);
  }

  @Post('transfers/:id/complete')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Complete a stock transfer (Receive stock)' })
  async completeTransfer(@Param('id') id: string, @Req() req: any) {
    return await this.warehousingService.completeTransfer(id, req.user.id);
  }
}
