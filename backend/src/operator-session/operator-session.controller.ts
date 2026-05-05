import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OperatorSessionService } from './operator-session.service';
import { AuthGuard } from '../auth/auth.guard';
import { StartSessionDto } from './dto/operator-session.dto';

@ApiTags('Operator Sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('operator/session')
export class OperatorSessionController {
  constructor(private readonly sessionService: OperatorSessionService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new operator session' })
  async startSession(@Req() req: any, @Body() dto: StartSessionDto & { force?: boolean }) {
    return await this.sessionService.startSession(
      req.user.sub,
      dto.lineId,
      dto.station,
      dto.shiftId,
      dto.force
    );
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent sessions for the current operator' })
  async getRecentSessions(@Req() req: any) {
    return await this.sessionService.getRecentSessions(req.user.sub);
  }

  @Get('all-active')
  @ApiOperation({ summary: 'Get all active operator sessions across the factory' })
  async getAllActiveSessions() {
    return await this.sessionService.getAllActiveSessions();
  }

  @Post('end')
  @ApiOperation({ summary: 'End the current active operator session' })
  async endSession(@Req() req: any) {
    return await this.sessionService.endSession(req.user.sub);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active operator session' })
  async getCurrentSession(@Req() req: any) {
    return await this.sessionService.getCurrentSession(req.user.sub);
  }
}
