import { Controller, Get, Post, Body, Param, UseGuards, Patch, Query, ParseIntPipe, HttpStatus, HttpCode } from '@nestjs/common';
import { BiometricService } from './biometric.service';
import { PayrollAttendanceService } from './payroll-attendance.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateDeviceDto } from './dto/create-device.dto';
import { CreateShiftDto, AssignShiftDto } from './dto/shift.dto';

@ApiTags('Biometric Attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('biometric')
export class BiometricController {
  constructor(
    private readonly biometricService: BiometricService,
    private readonly payrollService: PayrollAttendanceService
  ) {}

  @Get('devices')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get all biometric devices' })
  async getDevices() {
    return await this.biometricService.getDevices();
  }

  @Post('devices')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Register a new biometric device' })
  async createDevice(@Body() dto: CreateDeviceDto) {
    return await this.biometricService.createDevice(dto);
  }

  @Patch('devices/:id')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Update device configuration' })
  async updateDevice(@Param('id') id: string, @Body() dto: any) {
    return await this.biometricService.updateDevice(id, dto);
  }

  @Post('devices/:id/test')
  @HttpCode(HttpStatus.OK)
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Test TCP connection to a device' })
  async testConnection(@Param('id') id: string) {
    return await this.biometricService.testConnection(id);
  }

  @Post('devices/:id/sync')
  @HttpCode(HttpStatus.OK)
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Trigger manual log synchronization' })
  async triggerSync(@Param('id') id: string) {
    return await this.biometricService.syncLogs(id);
  }

  @Post('devices/sync-all')
  @HttpCode(HttpStatus.OK)
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Trigger sync for all active devices' })
  async syncAll() {
    return await this.biometricService.syncAllDevices();
  }

  @Get('logs')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get paginated raw attendance logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return await this.biometricService.getLogs(page, limit);
  }

  @Get('unmapped')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Identify logs with missing employee mapping' })
  async getUnmapped() {
    return await this.biometricService.getUnmappedLogs();
  }

  @Get('attendance/today')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get processed attendance for the current date' })
  async getTodayAttendance() {
    return await this.biometricService.getTodayAttendance();
  }

  @Post('map-user')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Map a biometric device user ID to an ERP user' })
  async mapUser(@Body() body: { deviceUserId: string; userId: string }) {
    return await this.biometricService.mapUser(body.deviceUserId, body.userId);
  }

  @Get('shifts')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get all active shifts' })
  async getShifts() {
    return await this.biometricService.getShifts();
  }

  @Post('shifts')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Create a new shift policy' })
  async createShift(@Body() dto: CreateShiftDto) {
    return await this.biometricService.createShift(dto);
  }

  @Post('shifts/assign')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Assign a shift to an employee' })
  async assignShift(@Body() dto: AssignShiftDto) {
    return await this.biometricService.assignShift(dto);
  }

  @Get('reports/monthly')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get monthly attendance aggregation for payroll' })
  async getMonthlyReport(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    return await this.payrollService.getMonthlyReport(month, year);
  }
}
