import { Controller, Get, Post, Body, Param, UseGuards, Patch, Query, ParseIntPipe, HttpStatus, HttpCode, Req, UnauthorizedException } from '@nestjs/common';
import { BiometricService } from './biometric.service';
import { PayrollAttendanceService } from './payroll-attendance.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
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
  @ApiOperation({ summary: 'Trigger manual log synchronization for all active devices' })
  async triggerSyncAll() {
    const devices = await this.biometricService.getDevices();
    const activeDevices = devices.filter(d => d.isActive);
    const results = [];
    for (const device of activeDevices) {
      try {
        const res = await this.biometricService.syncLogs(device.id);
        results.push({ device: device.name, status: 'success', ...res });
      } catch (err: any) {
        results.push({ device: device.name, status: 'error', error: err.message });
      }
    }
    return results;
  }

  // ── SERVERLESS CRON WEBHOOK (VERCEL COMPATIBILITY) ──
  @Public()
  @Post('cron/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Serverless Cron trigger for Biometric Sync (Secured by CRON_SECRET)' })
  async serverlessCronSync(@Body() body: any, @Req() req: any) {
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    
    if (!cronSecret) {
      throw new UnauthorizedException('CRON_SECRET is not configured on the server.');
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedException('Invalid Cron Secret');
    }

    const devices = await this.biometricService.getDevices();
    const activeDevices = devices.filter(d => d.isActive);
    let totalImported = 0;
    
    for (const device of activeDevices) {
      try {
        const res = await this.biometricService.syncLogs(device.id);
        totalImported += res.imported;
      } catch (err: any) {
        console.error(`[CRON] Device ${device.name} sync failed:`, err.message);
      }
    }
    
    return { success: true, importedLogs: totalImported };
  }

  @Get('logs')
  @Permissions('attendance:view')
  @ApiOperation({ summary: 'Get paginated raw attendance logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    const roles = req.user?.roles || [];
    return await this.biometricService.getLogs(page, limit, roles);
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
  async getTodayAttendance(@Req() req: any) {
    const roles = req.user?.roles || [];
    return await this.biometricService.getTodayAttendance(roles);
  }

  @Post('map-user')
  @Permissions('attendance:manage')
  @ApiOperation({ summary: 'Map a biometric device user ID to an ERP user' })
  async mapUser(@Req() req: any, @Body() body: { deviceUserId: string; userId: string }) {
    const actorRoles = req.user?.roles || [];
    return await this.biometricService.mapUser(body.deviceUserId, body.userId, actorRoles);
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
