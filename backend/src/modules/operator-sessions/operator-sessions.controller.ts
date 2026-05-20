import { Controller, Post, Get, Body, UseGuards, Req, Version, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OperatorSessionsService } from './operator-sessions.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StartSessionDto } from './dto/operator-sessions.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('Operator Sessions')
@ApiBearerAuth()
@Controller('operator-sessions')
@UseGuards(AuthGuard, RolesGuard)
export class OperatorSessionsController {
  constructor(
    private readonly sessionService: OperatorSessionsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('start')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Start a new operator session' })
  async startSession(@Req() req: any, @Body() dto: StartSessionDto & { force?: boolean, supervisorPin?: string }) {
    let supervisorId: string | undefined;

    if (dto.supervisorPin) {
      const supervisor = await this.usersService.verifySupervisorPin(dto.supervisorPin);
      if (!supervisor) {
        throw new ForbiddenException('Invalid Supervisor PIN');
      }
      supervisorId = supervisor.id;
    }

    return await this.sessionService.startSession(
      req.user.sub,
      dto.lineId,
      dto.station,
      dto.shiftId,
      dto.force,
      undefined, // terminalId
      supervisorId
    );
  }

  @Get('recent')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get recent sessions for the current operator' })
  async getRecentSessions(@Req() req: any) {
    return await this.sessionService.getRecentSessions(req.user.sub);
  }

  @Get('active')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all active operator sessions across the factory' })
  async getAllActiveSessions() {
    return await this.sessionService.getAllActiveSessions();
  }

  @Post('end')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'End the current active operator session' })
  async endSession(@Req() req: any) {
    return await this.sessionService.endSession(req.user.sub);
  }

  @Get('current')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get current active operator session' })
  async getCurrentSession(@Req() req: any) {
    return await this.sessionService.getCurrentSession(req.user.sub);
  }

  @Post('heartbeat')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update last activity timestamp for the current session' })
  async heartbeat(@Req() req: any) {
    return await this.sessionService.heartbeat(req.user.sub);
  }

  @Post('change-station')
  @Roles('OPERATOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Change station without logging out' })
  async changeStation(@Req() req: any, @Body() dto: { station: string }) {
    if (!dto.station) {
      throw new BadRequestException('Station is required');
    }
    return await this.sessionService.changeStation(req.user.sub, dto.station);
  }
}
