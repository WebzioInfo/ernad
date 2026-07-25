import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SalesService } from './sales.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Sales Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('customers')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'List all customers (with search & pagination)' })
  async getCustomers(@Req() req: any) {
    const query = req.query;
    if (query && Object.keys(query).length > 0) {
      return await this.salesService.getCustomersFiltered(query);
    }
    return await this.salesService.getCustomers();
  }

  @Get('customers/:id')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomerById(@Param('id') id: string) {
    return await this.salesService.getCustomerById(id);
  }

  @Post('customers')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('customers:create')
  @ApiOperation({ summary: 'Create a new customer' })
  async createCustomer(@Body() dto: any, @Req() req: any) {
    return await this.salesService.createCustomer(dto, req.user?.id || req.user?.sub);
  }

  @Patch('customers/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('customers:edit')
  @ApiOperation({ summary: 'Update an existing customer' })
  async updateCustomer(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return await this.salesService.updateCustomer(id, dto, req.user?.id || req.user?.sub);
  }

  @Delete('customers/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('customers:delete')
  @ApiOperation({ summary: 'Soft delete customer' })
  async deleteCustomer(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.deleteCustomer(id, req.user?.id || req.user?.sub);
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

  // ─── SALES TRANSACTIONS ENDPOINTS ──────────────────────────────────

  @Get('transactions')
  @Permissions('sales:view')
  @ApiOperation({ summary: 'List all sales transactions' })
  async getSalesTransactions(@Req() req: any) {
    return await this.salesService.getSalesTransactionsFiltered(req.query);
  }

  @Post('transactions')
  @Roles('ADMIN', 'ACCOUNTANT')
  @Permissions('sales:manage')
  @ApiOperation({ summary: 'Create a new sales transaction' })
  async createSalesTransaction(@Body() dto: any, @Req() req: any) {
    return await this.salesService.createSalesTransaction(dto, req.user.id);
  }

  @Patch('transactions/:id')
  @Roles('ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Update an existing sales transaction' })
  async updateSalesTransaction(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return await this.salesService.updateSalesTransaction(id, dto, req.user.id);
  }

  @Delete('transactions/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a sales transaction (Admin only)' })
  async deleteSalesTransaction(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.deleteSalesTransaction(id, req.user.id);
  }

  // ─── CUSTOMER PROFILE & LEDGER ENDPOINTS ────────────────────────────

  @Get('customers/:id/summary')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer summary metrics' })
  async getCustomerSummary(@Param('id') id: string) {
    return await this.salesService.getCustomerSummary(id);
  }

  @Get('customers/:id/ledger')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer ledger report' })
  async getCustomerLedger(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.getCustomerLedger(id, req.query);
  }

  @Get('customers/:id/sales')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer sales history' })
  async getCustomerSalesHistory(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.getCustomerSalesHistory(id, req.query);
  }

  @Get('customers/:id/payments')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer payment history' })
  async getCustomerPaymentHistory(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.getCustomerPaymentHistory(id, req.query);
  }

  @Get('customers/:id/returns')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer returns history' })
  async getCustomerReturnsHistory(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.getCustomerReturnsHistory(id, req.query);
  }

  @Get('customers/:id/damages')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer damages history' })
  async getCustomerDamagesHistory(@Param('id') id: string, @Req() req: any) {
    return await this.salesService.getCustomerDamagesHistory(id, req.query);
  }

  @Get('customers/:id/activities')
  @Permissions('customers:view')
  @ApiOperation({ summary: 'Get customer activity log' })
  async getCustomerActivities(@Param('id') id: string) {
    return await this.salesService.getCustomerActivities(id);
  }
}
