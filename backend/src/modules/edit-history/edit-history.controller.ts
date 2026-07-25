import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { EditHistoryService } from './edit-history.service';

@ApiTags('Edit History')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('edit-history')
export class EditHistoryController {
  constructor(private readonly editHistoryService: EditHistoryService) {}

  private checkOwnerOrAdminAccess(req: any) {
    const user = req.user;
    const userRole = String(user?.role || '').toUpperCase();
    const userRoles = Array.isArray(user?.roles) ? user.roles.map((r: string) => String(r).toUpperCase()) : [];
    
    const isOwnerOrAdmin =
      userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      userRole === 'COMPANY_OWNER' ||
      userRole === 'OWNER' ||
      userRoles.includes('ADMIN') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('COMPANY_OWNER') ||
      userRoles.includes('OWNER');

    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Access denied. Edit history is restricted exclusively to Company Owner and Super Admin.');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get edit history logs (Owner / Super Admin only)' })
  async getEditHistory(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('module') module?: string,
    @Query('employee') employee?: string,
    @Query('role') role?: string,
    @Query('field') field?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkOwnerOrAdminAccess(req);

    return await this.editHistoryService.getEditHistory({
      startDate,
      endDate,
      module,
      employee,
      role,
      field,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('record/:module/:recordId')
  @ApiOperation({ summary: 'Get edit history timeline for a specific record' })
  async getRecordHistory(
    @Req() req: any,
    @Param('module') module: string,
    @Param('recordId') recordId: string,
  ) {
    this.checkOwnerOrAdminAccess(req);
    return await this.editHistoryService.getRecordHistory(module, recordId);
  }
}
