import { Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';

@ApiTags('Staff Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sync')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('attendance:manage')
  async syncBiometricData() {
    return await this.attendanceService.syncBiometricData();
  }

  @Get('operator/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('attendance:view')
  async getOperatorAttendance(@Param('id') id: string) {
    return await this.attendanceService.getOperatorAttendance(id);
  }
}
