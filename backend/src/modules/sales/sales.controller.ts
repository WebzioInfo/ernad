import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SalesService } from './sales.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Sales Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('customers')
  @Permissions('sales:view')
  @ApiOperation({ summary: 'List all customers' })
  async getCustomers() {
    return await this.salesService.getCustomers();
  }

  @Get('orders')
  @Permissions('sales:view')
  @ApiOperation({ summary: 'List all sales orders' })
  async getOrders() {
    return await this.salesService.getOrders();
  }

  @Get('orders/:id')
  @Permissions('sales:view')
  @ApiOperation({ summary: 'Get sales order details' })
  async getOrderById(@Param('id') id: string) {
    return await this.salesService.getOrderById(id);
  }

  @Post('orders')
  @Permissions('sales:manage')
  @ApiOperation({ summary: 'Create a new sales order' })
  async createOrder(@Body() dto: any, @Req() req: any) {
    return await this.salesService.createOrder(dto, req.user.id);
  }

  @Patch('orders/:id/status')
  @Permissions('sales:manage')
  @ApiOperation({ summary: 'Update sales order status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return await this.salesService.updateOrderStatus(id, status);
  }
}
