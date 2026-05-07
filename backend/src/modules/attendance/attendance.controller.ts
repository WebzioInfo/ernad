import { Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';

@ApiTags('Staff Attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('all')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get all attendance logs' })
  async getAllAttendance() {
    return await this.attendanceService.getAllAttendance();
  }

  @Post('sync')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Trigger biometric data synchronization (Mock)' })
  async syncBiometricData() {
    return await this.attendanceService.syncBiometricData();
  }

  @Get('operator/:id')
  @Permissions('attendance:view')
  async getOperatorAttendance(@Param('id') id: string) {
    return await this.attendanceService.getOperatorAttendance(id);
  }
}
