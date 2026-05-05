import { Controller, Post, Query, Get, UseGuards } from '@nestjs/common';
import { DataLifecycleService } from './data-lifecycle.service';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';

@ApiTags('Data Lifecycle')
@Controller('lifecycle')
export class DataLifecycleController {
  constructor(private readonly lifecycleService: DataLifecycleService) {}

  @Post('cleanup')
  @ApiOperation({ summary: 'Manually trigger data cleanup/archiving' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Archive data older than X days' })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  async triggerCleanup(
    @Query('days') days?: number,
    @Query('dryRun') dryRun?: string
  ) {
    const isDryRun = dryRun === 'true';
    await this.lifecycleService.runCleanup(days || 90, isDryRun);
    return { message: 'Cleanup process initiated', dryRun: isDryRun };
  }
}
