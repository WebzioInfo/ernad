import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BackupService } from './backup.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Backup & Restore')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('backup')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get backup history and database metadata' })
  async getBackupHistory(@Req() req: any) {
    return await this.backupService.getBackupHistory(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new database backup snapshot' })
  async createBackup(@Req() req: any) {
    return await this.backupService.createBackup(req.user.id);
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download a database backup file' })
  async downloadBackup(@Param('filename') filename: string, @Req() req: any) {
    const backupDir = path.resolve(process.cwd(), 'backups');
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Backup file not found');
    }

    // Log Download action
    await this.auditService.logAction({
      userId: req.user.id,
      action: 'BACKUP_DOWNLOADED',
      entityType: 'database_backups',
      entityId: filename,
      category: 'GENERAL',
      payload: { filename },
    });

    const fileStream = fs.createReadStream(filePath);
    return new StreamableFile(fileStream, {
      type: 'application/zip',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete a database backup file' })
  async deleteBackup(@Param('filename') filename: string, @Req() req: any) {
    return await this.backupService.deleteBackup(filename, req.user.id);
  }

  @Post('restore-file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Restore database by uploading a backup zip file' })
  async restoreFromFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Backup zip file is required.');
    }
    return await this.backupService.restoreBackupFromFile(file.path || file.destination + '/' + file.filename, file.originalname, req.user.id);
  }

  @Post('restore/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore database using an existing backup file on server' })
  async restoreFromHistory(@Param('filename') filename: string, @Req() req: any) {
    return await this.backupService.restoreBackupFromHistory(filename, req.user.id);
  }
}
