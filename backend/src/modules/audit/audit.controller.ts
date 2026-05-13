import { Controller, Get, Query, UseGuards, Version, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Audit Trail')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('users:manage')
  @ApiOperation({ summary: 'Search and filter system audit logs (Admin only)' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getLogs(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('actorId') actorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const callerRoles = req.user?.roles || [];
    return await this.auditService.getLogs({
      category,
      actorId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }, callerRoles);
  }
}
