import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TallySyncService } from './tally-sync.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';

@ApiTags('Tally Integration')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('tally')
export class TallyController {
  constructor(private readonly tallyService: TallySyncService) {}

  @Post('sync')
  @Permissions('sales:manage')
  @ApiOperation({ summary: 'Sync sales data from Tally' })
  async syncData(@Body() data: any[]) {
    return await this.tallyService.syncSalesData(data);
  }

  @Get('summary')
  @Permissions('analytics:view')
  @ApiOperation({ summary: 'Get sales summary for dashboard' })
  async getSummary() {
    return await this.tallyService.getSalesSummary();
  }
}
